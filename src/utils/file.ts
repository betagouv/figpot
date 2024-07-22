import assert from 'assert';
import contentType from 'content-type';
import fsSync from 'fs';
import fs from 'fs/promises';
import { mimeData } from 'human-filetypes';
import { JsonStreamStringify } from 'json-stream-stringify';
import path from 'path';
import { Readable } from 'stream';
import { chain } from 'stream-chain';
import Asm from 'stream-json/Assembler';
import { disassembler } from 'stream-json/Disassembler';
import { parser } from 'stream-json/Parser';
import { stringer } from 'stream-json/Stringer';

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
  return await new Promise((resolve, reject) => {
    const jsonStream = new JsonStreamStringify(jsonObject);

    jsonStream.once('error', reject);
    jsonStream.once('end', resolve);
    jsonStream.once('close', resolve);

    jsonStream.pipe(
      fsSync.createWriteStream(filePath, {
        encoding: 'utf-8',
      })
    );
  });
}
