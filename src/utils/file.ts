import assert from 'assert';
import contentType from 'content-type';
import fsSync from 'fs';
import type { openAsBlob as originalOpenAsBlob } from 'fs';
import fs from 'fs/promises';
import { mimeData } from 'human-filetypes';
import { JsonStreamStringify } from 'json-stream-stringify';
import path from 'path';
import { pipeline } from 'stream';
import streamChain from 'stream-chain';
import Asm from 'stream-json/Assembler.js';
import streamJsonParser from 'stream-json/Parser.js';

const { chain } = streamChain;
const { parser } = streamJsonParser;

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

export async function readBigJsonFile(filePath: string): Promise<object> {
  return await new Promise((resolve, reject) => {
    const pipeline = chain([
      fsSync.createReadStream(filePath, {
        encoding: 'utf-8',
      }),
      parser(),
    ]);

    pipeline.once('error', (error) => {
      reject(error);
    });

    const asm = Asm.connectTo(pipeline);

    asm.once('done', (asm) => {
      resolve(asm.current);
    });
  });
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
