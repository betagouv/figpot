import { Readable } from 'stream';
import streamChain from 'stream-chain';
import Asm from 'stream-json/Assembler.js';
import streamJsonParser from 'stream-json/Parser.js';
import { ReadableStream } from 'stream/web';

import {
  appCommonGeomPoint$point,
  appCommonSchema$any,
  appCommonSchema$safe_int,
  appCommonSchema$safe_number,
  appCommonSchema$text,
  appCommonSchema$uuid,
  appCommonTime$inst,
  appCommonTypesPage$flow,
  appCommonTypesPage$guide,
  appCommonTypesPlugins$plugin_data,
  appCommonTypesTypography$typography,
  appCommonTypesVariant$variant_property,
} from '@figpot/src/clients/penpot';

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

      pipeline.once('error', (error) => {
        reject(error);
      });

      const asm = Asm.connectTo(pipeline);

      asm.once('done', (asm) => {
        resolve(asm.current);
      });
    });
  } else {
    return await response.json();
  }
}

// By default "appCommonFilesChanges$change" type has an union with `unknown` (probably in case they pass new things)
// but in our case we know in advance what can be passed. And there is no way to `Exclude<appCommonFilesChanges$change, unknown>`
// because it results into "never"... To avoid complicated things we prefer to copy/paste the defintion from `src/clients/penpot/types.gen.ts`
// to have something proper since even type guard on a few properties would not work due to `unknown` able to be anything
//
// We even exclude the one for comments since not used yet
export type appCommonFilesChanges$changeWithoutUnknown =
  // | {
  //     commentThreadId: appCommonSchema$uuid;
  //     pageId: appCommonSchema$uuid;
  //     frameId: appCommonSchema$uuid | null;
  //     position: appCommonGeomPoint$point | null;
  //   }
  | {
      type: 'add-obj';
      id: appCommonSchema$uuid;
      obj: unknown;
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      frameId: appCommonSchema$uuid;
      parentId?: appCommonSchema$uuid | null;
      index?: number | null;
      ignoreTouched?: boolean;
    }
  | {
      type: 'mod-obj';
      id: appCommonSchema$uuid;
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      operations: Array<
        | {
            type: 'assign';
            value: {
              [key: string]: appCommonSchema$any;
            };
            ignoreTouched?: boolean;
            ignoreGeometry?: boolean;
          }
        | {
            type: 'set';
            attr: string;
            val: appCommonSchema$any;
            ignoreTouched?: boolean;
            ignoreGeometry?: boolean;
          }
        | {
            type: 'set-touched';
            touched: Array<string> | null;
          }
        | {
            type: 'set-remote-synced';
            remoteSynced?: boolean | null;
          }
      >;
    }
  | {
      type: 'del-obj';
      id: appCommonSchema$uuid;
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      ignoreTouched?: boolean;
    }
  | {
      type: 'set-guide';
      pageId: appCommonSchema$uuid;
      id: appCommonSchema$uuid;
      params: appCommonTypesPage$guide | null;
    }
  | {
      type: 'set-flow';
      pageId: appCommonSchema$uuid;
      id: appCommonSchema$uuid;
      params: appCommonTypesPage$flow | null;
    }
  | {
      type: 'set-default-grid';
      pageId: appCommonSchema$uuid;
      gridType: 'square';
      params: {
        size?: appCommonSchema$safe_number | null;
        color: {
          /**
           * HEX Color String
           */
          color: unknown;
          opacity: appCommonSchema$safe_number;
        };
      } | null;
    }
  | {
      type: 'set-default-grid';
      pageId: appCommonSchema$uuid;
      gridType: 'column';
      params: {
        color: {
          /**
           * HEX Color String
           */
          color: unknown;
          opacity: appCommonSchema$safe_number;
        };
        /**
         * One of the Set
         */
        type?: unknown;
        size?: appCommonSchema$safe_number | null;
        margin?: appCommonSchema$safe_number | null;
        itemLength?: appCommonSchema$safe_number | null;
        gutter?: appCommonSchema$safe_number | null;
      } | null;
    }
  | {
      type: 'set-default-grid';
      pageId: appCommonSchema$uuid;
      gridType: 'row';
      params: {
        color: {
          /**
           * HEX Color String
           */
          color: unknown;
          opacity: appCommonSchema$safe_number;
        };
        /**
         * One of the Set
         */
        type?: unknown;
        size?: appCommonSchema$safe_number | null;
        margin?: appCommonSchema$safe_number | null;
        itemLength?: appCommonSchema$safe_number | null;
        gutter?: appCommonSchema$safe_number | null;
      } | null;
    }
  | {
      type: 'fix-obj';
      id: appCommonSchema$uuid;
      fix?: string;
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
    }
  | {
      type: 'mov-objects';
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      ignoreTouched?: boolean;
      parentId: appCommonSchema$uuid;
      shapes: appCommonSchema$any;
      index?: number | null;
      afterShape?: appCommonSchema$any;
      allowAlteringCopies?: boolean;
    }
  | {
      type: 'reorder-children';
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      ignoreTouched?: boolean;
      parentId: appCommonSchema$uuid;
      shapes: appCommonSchema$any;
    }
  | {
      type: 'add-page';
      id?: appCommonSchema$uuid;
      name?: string;
      page?: appCommonSchema$any;
    }
  | {
      type: 'mod-page';
      id: appCommonSchema$uuid;
      background?: unknown | null;
      name?: string;
    }
  | ({
      type: 'set-plugin-data';
      /**
       * One of the Set
       */
      objectType: unknown;
      objectId?: appCommonSchema$uuid;
      pageId?: appCommonSchema$uuid;
      namespace: string;
      key: string;
      value: string | null;
    } & unknown)
  | {
      type: 'del-page';
      id: appCommonSchema$uuid;
    }
  | {
      type: 'mov-page';
      id: appCommonSchema$uuid;
      index: number;
    }
  | {
      type: 'reg-objects';
      pageId?: appCommonSchema$uuid;
      componentId?: appCommonSchema$uuid;
      shapes: Array<appCommonSchema$uuid>;
    }
  | {
      type: 'add-color';
      color: {
        id: appCommonSchema$uuid;
        name: appCommonSchema$text;
        path?: string;
        /**
         * int
         */
        opacity?: unknown;
        modifiedAt?: appCommonTime$inst;
        pluginData?: appCommonTypesPlugins$plugin_data;
        /**
         * HEX Color String
         */
        color?: unknown;
        gradient?: {
          /**
           * One of the Set
           */
          type: unknown;
          startX: appCommonSchema$safe_number;
          startY: appCommonSchema$safe_number;
          endX: appCommonSchema$safe_number;
          endY: appCommonSchema$safe_number;
          width: appCommonSchema$safe_number;
          stops: Array<{
            /**
             * HEX Color String
             */
            color: unknown;
            /**
             * int
             */
            opacity?: unknown;
            /**
             * int
             */
            offset: unknown;
          }>;
        };
        image?: {
          /**
           * int
           */
          width: unknown;
          /**
           * int
           */
          height: unknown;
          mtype: appCommonSchema$text;
          id: appCommonSchema$uuid;
          name?: appCommonSchema$text;
          keepAspectRatio?: boolean;
        };
      } & unknown;
    }
  | {
      type: 'mod-color';
      color: {
        id: appCommonSchema$uuid;
        name: appCommonSchema$text;
        path?: string;
        /**
         * int
         */
        opacity?: unknown;
        modifiedAt?: appCommonTime$inst;
        pluginData?: appCommonTypesPlugins$plugin_data;
        /**
         * HEX Color String
         */
        color?: unknown;
        gradient?: {
          /**
           * One of the Set
           */
          type: unknown;
          startX: appCommonSchema$safe_number;
          startY: appCommonSchema$safe_number;
          endX: appCommonSchema$safe_number;
          endY: appCommonSchema$safe_number;
          width: appCommonSchema$safe_number;
          stops: Array<{
            /**
             * HEX Color String
             */
            color: unknown;
            /**
             * int
             */
            opacity?: unknown;
            /**
             * int
             */
            offset: unknown;
          }>;
        };
        image?: {
          /**
           * int
           */
          width: unknown;
          /**
           * int
           */
          height: unknown;
          mtype: appCommonSchema$text;
          id: appCommonSchema$uuid;
          name?: appCommonSchema$text;
          keepAspectRatio?: boolean;
        };
      } & unknown;
    }
  | {
      type: 'del-color';
      id: appCommonSchema$uuid;
    }
  | {
      type: 'add-media';
      object: {
        id: appCommonSchema$uuid;
        createdAt?: appCommonTime$inst;
        deletedAt?: appCommonTime$inst;
        name: string;
        width: appCommonSchema$safe_int;
        height: appCommonSchema$safe_int;
        mtype: string;
        mediaId: appCommonSchema$uuid;
        fileId?: appCommonSchema$uuid;
        thumbnailId?: appCommonSchema$uuid;
        isLocal?: boolean;
      };
    }
  | {
      type: 'mod-media';
      object: {
        id: appCommonSchema$uuid;
        createdAt?: appCommonTime$inst;
        deletedAt?: appCommonTime$inst;
        name: string;
        width: appCommonSchema$safe_int;
        height: appCommonSchema$safe_int;
        mtype: string;
        mediaId: appCommonSchema$uuid;
        fileId?: appCommonSchema$uuid;
        thumbnailId?: appCommonSchema$uuid;
        isLocal?: boolean;
      };
    }
  | {
      type: 'del-media';
      id: appCommonSchema$uuid;
    }
  | {
      type: 'add-component';
      id: appCommonSchema$uuid;
      name: string;
      shapes?: Array<appCommonSchema$any>;
      path?: string;
    }
  | {
      type: 'mod-component';
      id: appCommonSchema$uuid;
      shapes?: Array<appCommonSchema$any>;
      name?: string;
      variantId?: appCommonSchema$uuid;
      variantProperties?: Array<appCommonTypesVariant$variant_property>;
    }
  | {
      type: 'del-component';
      id: appCommonSchema$uuid;
      delta?: appCommonGeomPoint$point;
      skipUndelete?: boolean;
    }
  | {
      type: 'restore-component';
      id: appCommonSchema$uuid;
      pageId: appCommonSchema$uuid;
    }
  | {
      type: 'purge-component';
      id: appCommonSchema$uuid;
    }
  | {
      type: 'add-typography';
      typography: appCommonTypesTypography$typography;
    }
  | {
      type: 'mod-typography';
      typography: appCommonTypesTypography$typography;
    }
  | {
      type: 'del-typography';
      id: appCommonSchema$uuid;
    }
  | {
      type: 'update-active-token-themes';
      themePaths: Array<string>;
    }
  | {
      type: 'rename-token-set-group';
      setGroupPath: Array<string>;
      setGroupFname: string;
    }
  | {
      type: 'move-token-set';
      fromPath: Array<string>;
      toPath: Array<string>;
      beforePath: Array<string> | null;
      beforeGroup: boolean | null;
    }
  | {
      type: 'move-token-set-group';
      fromPath: Array<string>;
      toPath: Array<string>;
      beforePath: Array<string> | null;
      beforeGroup: boolean | null;
    }
  | {
      type: 'set-token-theme';
      themeName: string;
      group: string;
      theme: {
        id: appCommonSchema$uuid;
        name: string;
        group?: string;
        description?: string;
        isSource?: boolean;
        externalId?: string;
        modifiedAt?: appCommonTime$inst;
        sets?: Array<string>;
      } | null;
    }
  | {
      type: 'set-tokens-lib';
      tokensLib: appCommonSchema$any;
    }
  | {
      type: 'set-token-set';
      setName: string;
      group: boolean;
      tokenSet: unknown | null;
    }
  | {
      type: 'set-token';
      setName: string;
      tokenId: appCommonSchema$uuid;
      token: {
        id: appCommonSchema$uuid;
        name: string;
        /**
         * One of the Set
         */
        type: unknown;
        value: appCommonSchema$any;
        description?: string;
        modifiedAt?: appCommonTime$inst;
      } | null;
    }
  | {
      type: 'set-base-font-size';
      baseFontSize: string;
    };
