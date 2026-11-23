import { Readable } from 'stream';
import { ReadableStream as NodeReadableStream } from 'stream/web';

import { client as figmaClient } from '@figpot/src/clients/figma/client.gen';
import { PostUpdateFileData } from '@figpot/src/clients/penpot';
import { client as penpotClient } from '@figpot/src/clients/penpot/client.gen';
import { readBigJsonStream } from '@figpot/src/utils/file';

// Thrown by both generated clients when the server answers with an error status, so callers can check the status
// (the generated clients would otherwise throw the raw error body)
export class ApiError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown
  ) {
    super(`${status} ${statusText} (${url})`);
    this.name = 'ApiError';
  }
}

for (const client of [figmaClient, penpotClient]) {
  client.interceptors.error.use((error, response, request) => {
    // Other errors (network failure, interrupted response body...) are kept as they are, so they are not taken as a server answer
    if (!response || response.ok) {
      return error;
    }

    return new ApiError(request?.url ?? response.url, response.status, response.statusText, error);
  });
}

penpotClient.interceptors.error.use((error) => {
  // Penpot validation errors give their details as a list of objects, logging them fully instead of `[ [Object], [Object], ... ]`
  const details = error instanceof ApiError ? (error.body as { details?: unknown })?.details : undefined;
  if (Array.isArray(details)) {
    console.error(JSON.stringify(details));
  }

  return error;
});

// Options to get the raw response stream instead of a parsed content
export const streamedResponse = { parseAs: 'stream' } as const;

// A huge JSON content (like an entire Figma or Penpot file) cannot be parsed by the generated clients since they read it
// as a string, which cannot go over ~512MB (`ERR_STRING_TOO_LONG`). For these calls we get the raw stream and parse it ourselves
export async function readBigJsonResponse<T>(data: unknown, label: string): Promise<T> {
  if (!(data instanceof NodeReadableStream)) {
    throw new Error(`the response of ${label} was expected as a stream`);
  }

  return (await readBigJsonStream(Readable.fromWeb(data), label)) as T;
}

// [WORKAROUND] Penpot sends back all the changes we just pushed, for huge documents it doubles or more the time of
// processing, and since we do not use this answer we get the raw stream to cancel it right away
// Note: ideally the backend would not send at all this over the network
export async function ignoreResponse(data: unknown): Promise<void> {
  if (data instanceof NodeReadableStream) {
    await data.cancel();
  }
}

// We have to do this to avoid the operation about comments that as not "type" and that would complicate our array of operations
type WithTypeProperty<T> = T extends { type: any } ? T : never;

export type appCommonFilesChanges$changeWithoutUnknown = WithTypeProperty<NonNullable<NonNullable<PostUpdateFileData['body']>['changes']>[0]>;
