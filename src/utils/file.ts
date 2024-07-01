import assert from 'assert';
import contentType from 'content-type';
import fs from 'fs/promises';
import { mimeData } from 'human-filetypes';
import path from 'path';

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
