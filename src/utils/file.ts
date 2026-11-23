import contentType from 'content-type';
import fsSync from 'fs';
import type { openAsBlob as originalOpenAsBlob } from 'fs';
import fs from 'fs/promises';
import { mimeData } from 'human-filetypes';
import { JsonStreamStringify } from 'json-stream-stringify';
import path from 'path';
import { Readable, pipeline } from 'stream';
import chain from 'stream-chain';
import Assembler from 'stream-json/assembler.js';
import parser from 'stream-json/parser.js';

import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export async function downloadFile(url: string, destination: string, timeout?: number): Promise<void> {
  const response = await fetch(url, {
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });

  if (!response.ok) {
    throw new Error(`failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentTypeHeader = response.headers.get('content-type');
  if (!contentTypeHeader) {
    throw new Error(`the file content type is expected`);
  }

  // We use the content type to force the file extension to be able to easily open the file locally
  // but also to easily guess the content-type when finally uploading the file
  const contentTypeObject = contentType.parse(contentTypeHeader);

  const fileKind = mimeData[contentTypeObject.type];
  const possibleExtensions = fileKind.extensions || [];

  assert(possibleExtensions.length > 0);

  const filePathWithExtension = `${destination}${possibleExtensions[0]}`; // The extension already contains the dot

  const content = await response.arrayBuffer();

  await fs.mkdir(path.dirname(filePathWithExtension), { recursive: true });
  await fs.writeFile(filePathWithExtension, new Uint8Array(content));
}

// Parses a JSON content without holding its whole text in memory, since a string cannot go over ~512MB (`ERR_STRING_TOO_LONG`)
export async function readBigJsonStream(stream: Readable, label: string): Promise<object> {
  return await new Promise((resolve, reject) => {
    const tokens = chain([stream, parser()]);

    const assembler = Assembler.connectTo(tokens, {
      onDone: (doneAssembler) => {
        resolve(doneAssembler.current as object);
      },
    });

    tokens.once('error', (error: Error) => {
      reject(error);
    });

    tokens.once('end', () => {
      if (!assembler.done) {
        reject(new Error(`the JSON content of ${label} ended before being complete`));
      }
    });
  });
}

export async function readBigJsonFile(filePath: string): Promise<object> {
  return await readBigJsonStream(fsSync.createReadStream(filePath, { encoding: 'utf-8' }), `the file "${filePath}"`);
}

export type JsonPath = (string | number)[];

// Reads a big JSON file building only the values whose path is selected (one at a time), so the whole content is never in
// memory. A selected value is passed with its path, and the reading waits for the callback before going on
export async function streamBigJsonFileValues(
  filePath: string,
  select: (path: JsonPath) => boolean,
  onValue: (path: JsonPath, value: unknown) => void | Promise<void>
): Promise<void> {
  const tokens = chain([fsSync.createReadStream(filePath, { encoding: 'utf-8' }), parser({ packValues: true, streamValues: false })]);

  // Position in the document: the current key of each object, or the current index of each array
  const frames: { key: string | number | null; isArray: boolean }[] = [];

  let assembler: Assembler | null = null;
  let assembledPath: JsonPath = [];
  let assembledDepth = 0;

  for await (const token of tokens as AsyncIterable<parser.Token>) {
    if (assembler) {
      assembler.consume(token);

      if (token.name === 'startObject' || token.name === 'startArray') {
        assembledDepth++;
      } else if (token.name === 'endObject' || token.name === 'endArray') {
        assembledDepth--;
      }

      if (assembledDepth === 0) {
        await onValue(assembledPath, assembler.current);

        assembler = null;
      }

      continue;
    }

    if (token.name === 'keyValue') {
      frames[frames.length - 1].key = token.value as string;

      continue;
    } else if (token.name === 'endObject' || token.name === 'endArray') {
      frames.pop();

      continue;
    }

    // A value starts
    const parent = frames[frames.length - 1];
    if (parent?.isArray) {
      parent.key = (parent.key as number) + 1;
    }

    const valuePath = frames.map((frame) => frame.key as string | number);

    if (valuePath.length > 0 && select(valuePath)) {
      assembler = new Assembler();
      assembler.consume(token);
      assembledPath = valuePath;
      assembledDepth = token.name === 'startObject' || token.name === 'startArray' ? 1 : 0;

      if (assembledDepth === 0) {
        await onValue(assembledPath, assembler.current);

        assembler = null;
      }
    } else if (token.name === 'startObject') {
      frames.push({ key: null, isArray: false });
    } else if (token.name === 'startArray') {
      frames.push({ key: -1, isArray: true });
    }
  }
}

export async function writeBigJsonFile(filePath: string, jsonObject: object): Promise<void> {
  // [WORKAROUND] We do not use `stream-json` as we do for reading
  // since its internal logic will go over arrays size limit when transforming the object
  // Ref: https://github.com/uhop/stream-json/issues/157
  const jsonStream = new JsonStreamStringify(jsonObject);

  const fileStream = fsSync.createWriteStream(filePath, {
    encoding: 'utf-8',
  });

  return await new Promise((resolve, reject) => {
    pipeline(jsonStream, fileStream, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// We define our own instead of using `import { openAsBlob } from 'fs';` since it has been released inside Node.js v20 that is pretty recent
// By using this polyfill users can remain on a lower Node.js version
export async function openAsBlob(path: fsSync.PathLike, options?: fsSync.OpenAsBlobOptions): Promise<Blob> {
  const buffer = await fs.readFile(path);

  return new Blob([buffer], options);
}
openAsBlob satisfies typeof originalOpenAsBlob;
