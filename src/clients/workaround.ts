import { Readable } from 'stream';
import streamChain from 'stream-chain';
import Asm from 'stream-json/Assembler.js';
import streamJsonParser from 'stream-json/Parser.js';
import { ReadableStream } from 'stream/web';

const { chain } = streamChain;
const { parser } = streamJsonParser;

export async function getJsonResponseBody(response: Response): Promise<any> {
  // [WORKAROUND] When the content is over 500MB it cannot fit into a string to be parsed (e.g. error `ERR_STRING_TOO_LONG`)
  // So we use directly the stream with the most optimized library to do that
  const contentLength = response.headers.get('Content-Length');

  // [WORKAROUND] Currently the backend is sending back all changes we just did
  // For huge documents it doubles or more the time of processing, since the answer is not used now we just ignore it
  // Note: ideally the backend would not send at all this over the network
  if (response.status >= 200 && response.status < 300 && response.body && response.url.endsWith('api/rpc/command/update-file')) {
    response.body.cancel();

    return { message: `unusable patched object, please see "src/clients/workaround.ts"` };
  }

  if (
    response.body &&
    ((contentLength && parseInt(contentLength, 10) >= 0x1fffffe8) ||
      // [WORKAROUND] `Content-Length` header is not returned so applying the patch to appropriate URLs
      response.url.includes('v1/files/') || // For Figma to get an entire file
      response.url.endsWith('api/rpc/command/get-file')) // For Penpot to get an entire file (stricter condition since that's the prefix of other endpoints)
  ) {
    // [WORKAROUND] Have to cast the stream to keep things simple (we made sure it works inside Node.js)
    // Ref: https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/65542
    const stream = Readable.fromWeb(response.body as ReadableStream<any>);

    return await new Promise((resolve, reject) => {
      const pipeline = chain([stream, parser()]);

      const asm = Asm.connectTo(pipeline);

      asm.once('done', (asm) => {
        resolve(asm.current);
      });
    });
  } else {
    return await response.json();
  }
}
