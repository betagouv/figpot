import { Readable } from 'stream';
import { chain } from 'stream-chain';
import Asm from 'stream-json/Assembler';
import { parser } from 'stream-json/Parser';

export async function getJsonResponseBody(response: Response): Promise<any> {
  // [WORKAROUND] When the content is over 500MB it cannot fit into a string to be parsed (e.g. error `ERR_STRING_TOO_LONG`)
  // So we use directly the stream with the most optimized library to do that
  const contentLength = response.headers.get('Content-Length');

  // [WORKAROUND] Currently the backend is sending back all changes we just did
  // For huge documents it doubles or more the time of processing, since the answer is not used now we just ignore it
  // Note: ideally the backend would not send at all this over the network
  if (response.url.endsWith('api/rpc/command/update-file')) {
    return { message: `unusable patched object, please see "src/clients/workaround.ts"` };
  }

  if (
    response.body &&
    ((contentLength && parseInt(contentLength, 10) >= 0x1fffffe8) ||
      // [WORKAROUND] `Content-Length` header is not returned so applying the patch to appropriate URLs
      response.url.includes('v1/files/') || // For Figma to get an entire file
      response.url.endsWith('api/rpc/command/get-file')) // For Penpot to get an entire file (stricter condition since that's the prefix of other endpoints)
  ) {
    const stream = Readable.fromWeb(response.body);

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
