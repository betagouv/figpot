import { Readable } from 'stream';
import streamChain from 'stream-chain';
import Asm from 'stream-json/Assembler.js';
import streamJsonParser from 'stream-json/Parser.js';
import { ReadableStream } from 'stream/web';

import {
  appCommonGeomMatrix$matrix,
  appCommonGeomPoint$point,
  appCommonGeomRect$rect,
  appCommonSchema$any,
  appCommonSchema$inst,
  appCommonSchema$int,
  appCommonSchema$safe_int,
  appCommonSchema$safe_number,
  appCommonSchema$text,
  appCommonSchema$uuid,
  appCommonTypesGrid$grid,
  appCommonTypesPage$flow,
  appCommonTypesPage$guide,
  appCommonTypesPlugins$plugin_data,
  appCommonTypesShapeBlur$blur,
  appCommonTypesShapeExport$export,
  appCommonTypesShapeInteractions$interaction,
  appCommonTypesShapeText$content,
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
  // {
  //     commentThreadId: appCommonSchema$uuid;
  //     pageId: appCommonSchema$uuid;
  //     frameId: appCommonSchema$uuid | null;
  //     position: appCommonGeomPoint$point | null;
  // } |
  | {
      type: 'add-obj';
      id: appCommonSchema$uuid;
      obj:
        | (unknown & {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            shapes: Array<appCommonSchema$uuid>;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            x: appCommonSchema$safe_number;
            y: appCommonSchema$safe_number;
            width: appCommonSchema$safe_number;
            height: appCommonSchema$safe_number;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          })
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layout?: unknown;
            /**
             * One of the Set
             */
            layoutFlexDir?: unknown;
            layoutGap?: {
              rowGap?: appCommonSchema$safe_number;
              columnGap?: appCommonSchema$safe_number;
            };
            /**
             * One of the Set
             */
            layoutGapType?: unknown;
            /**
             * One of the Set
             */
            layoutWrapType?: unknown;
            /**
             * One of the Set
             */
            layoutPaddingType?: unknown;
            layoutPadding?: {
              p1: appCommonSchema$safe_number;
              p2: appCommonSchema$safe_number;
              p3: appCommonSchema$safe_number;
              p4: appCommonSchema$safe_number;
            };
            /**
             * One of the Set
             */
            layoutJustifyContent?: unknown;
            /**
             * One of the Set
             */
            layoutJustifyItems?: unknown;
            /**
             * One of the Set
             */
            layoutAlignContent?: unknown;
            /**
             * One of the Set
             */
            layoutAlignItems?: unknown;
            /**
             * One of the Set
             */
            layoutGridDir?: unknown;
            layoutGridRows?: Array<{
              /**
               * One of the Set
               */
              type: unknown;
              value?: appCommonSchema$safe_number | null;
            }>;
            layoutGridColumns?: Array<{
              /**
               * One of the Set
               */
              type: unknown;
              value?: appCommonSchema$safe_number | null;
            }>;
            layoutGridCells?: {
              [key: string]: {
                id: appCommonSchema$uuid;
                areaName?: string;
                row: appCommonSchema$safe_int;
                rowSpan: appCommonSchema$safe_int;
                column: appCommonSchema$safe_int;
                columnSpan: appCommonSchema$safe_int;
                /**
                 * One of the Set
                 */
                position?: unknown;
                /**
                 * One of the Set
                 */
                alignSelf?: unknown;
                /**
                 * One of the Set
                 */
                justifySelf?: unknown;
                shapes: Array<appCommonSchema$uuid>;
              };
            };
            shapes: Array<appCommonSchema$uuid>;
            hideFillOnExport?: boolean;
            showContent?: boolean;
            hideInViewer?: boolean;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            x: appCommonSchema$safe_number;
            y: appCommonSchema$safe_number;
            width: appCommonSchema$safe_number;
            height: appCommonSchema$safe_number;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
            variantId?: appCommonSchema$uuid;
            variantName?: string;
            variantError?: string;
            isVariantContainer?: boolean;
          }
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            shapes: Array<appCommonSchema$uuid>;
            /**
             * One of the Set
             */
            boolType: unknown;
            content: unknown;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          }
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            x: appCommonSchema$safe_number;
            y: appCommonSchema$safe_number;
            width: appCommonSchema$safe_number;
            height: appCommonSchema$safe_number;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          }
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            metadata: {
              width: appCommonSchema$int;
              height: appCommonSchema$int;
              mtype?: string | null;
              id: appCommonSchema$uuid;
            };
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            x: appCommonSchema$safe_number;
            y: appCommonSchema$safe_number;
            width: appCommonSchema$safe_number;
            height: appCommonSchema$safe_number;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          }
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            content: unknown;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          }
        | {
            /**
             * One of the Set
             */
            layoutItemMarginType?: unknown;
            layoutItemMargin?: {
              m1?: appCommonSchema$safe_number;
              m2?: appCommonSchema$safe_number;
              m3?: appCommonSchema$safe_number;
              m4?: appCommonSchema$safe_number;
            };
            layoutItemMaxH?: appCommonSchema$safe_number;
            layoutItemMinH?: appCommonSchema$safe_number;
            layoutItemMaxW?: appCommonSchema$safe_number;
            layoutItemMinW?: appCommonSchema$safe_number;
            /**
             * One of the Set
             */
            layoutItemHSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemVSizing?: unknown;
            /**
             * One of the Set
             */
            layoutItemAlignSelf?: unknown;
            layoutItemAbsolute?: boolean;
            layoutItemZIndex?: appCommonSchema$safe_number;
            content?: appCommonTypesShapeText$content | null;
            pageId?: appCommonSchema$uuid;
            componentId?: appCommonSchema$uuid;
            componentFile?: appCommonSchema$uuid;
            componentRoot?: boolean;
            mainInstance?: boolean;
            remoteSynced?: boolean;
            shapeRef?: appCommonSchema$uuid;
            touched?: Array<string> | null;
            blocked?: boolean;
            collapsed?: boolean;
            locked?: boolean;
            hidden?: boolean;
            maskedGroup?: boolean;
            fills?: Array<
              {
                fillColorRefFile?: appCommonSchema$uuid;
                fillColorRefId?: appCommonSchema$uuid;
                /**
                 * int
                 */
                fillOpacity?: unknown;
                /**
                 * HEX Color String
                 */
                fillColor?: unknown;
                fillColorGradient?: {
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
                fillImage?: {
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
              } & unknown
            >;
            proportion?: appCommonSchema$safe_number;
            proportionLock?: boolean;
            /**
             * One of the Set
             */
            constraintsH?: unknown;
            /**
             * One of the Set
             */
            constraintsV?: unknown;
            fixedScroll?: boolean;
            r1?: appCommonSchema$safe_number;
            r2?: appCommonSchema$safe_number;
            r3?: appCommonSchema$safe_number;
            r4?: appCommonSchema$safe_number;
            opacity?: appCommonSchema$safe_number;
            grids?: Array<appCommonTypesGrid$grid>;
            exports?: Array<appCommonTypesShapeExport$export>;
            strokes?: Array<
              {
                strokeColorRefFile?: appCommonSchema$uuid;
                strokeColorRefId?: appCommonSchema$uuid;
                strokeOpacity?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeStyle?: unknown;
                strokeWidth?: appCommonSchema$safe_number;
                /**
                 * One of the Set
                 */
                strokeAlignment?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapStart?: unknown;
                /**
                 * One of the Set
                 */
                strokeCapEnd?: unknown;
                /**
                 * HEX Color String
                 */
                strokeColor?: unknown;
                strokeColorGradient?: {
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
                strokeImage?: {
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
              } & unknown
            >;
            /**
             * One of the Set
             */
            blendMode?: unknown;
            interactions?: Array<appCommonTypesShapeInteractions$interaction>;
            shadow?: Array<{
              id: appCommonSchema$uuid | null;
              style: string & unknown;
              offsetX: appCommonSchema$safe_number;
              offsetY: appCommonSchema$safe_number;
              blur: appCommonSchema$safe_number;
              spread: appCommonSchema$safe_number;
              hidden: boolean;
              color: {
                /**
                 * int
                 */
                opacity?: unknown;
                refId?: appCommonSchema$uuid;
                refFile?: appCommonSchema$uuid;
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
            }>;
            blur?: appCommonTypesShapeBlur$blur;
            /**
             * One of the Set
             */
            growType?: unknown;
            appliedTokens?: {
              r1?: string;
              r2?: string;
              r3?: string;
              r4?: string;
              width?: string;
              height?: string;
              layoutItemMinW?: string;
              layoutItemMaxW?: string;
              layoutItemMinH?: string;
              layoutItemMaxH?: string;
              rowGap?: string;
              columnGap?: string;
              p1?: string;
              p2?: string;
              p3?: string;
              p4?: string;
              m1?: string;
              m2?: string;
              m3?: string;
              m4?: string;
              rotation?: string;
              lineHeight?: string;
              fontSize?: string;
              letterSpacing?: string;
              strokeWidth?: string;
            };
            pluginData?: appCommonTypesPlugins$plugin_data;
            x: appCommonSchema$safe_number;
            y: appCommonSchema$safe_number;
            width: appCommonSchema$safe_number;
            height: appCommonSchema$safe_number;
            id: appCommonSchema$uuid;
            name: string;
            /**
             * One of the Set
             */
            type: unknown;
            selrect: appCommonGeomRect$rect;
            points: Array<appCommonGeomPoint$point>;
            transform: appCommonGeomMatrix$matrix;
            transformInverse: appCommonGeomMatrix$matrix;
            parentId: appCommonSchema$uuid;
            frameId: appCommonSchema$uuid;
          };
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
        modifiedAt?: appCommonSchema$inst;
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
        modifiedAt?: appCommonSchema$inst;
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
  // | unknown
  | {
      type: 'add-media';
      object: {
        id: appCommonSchema$uuid;
        createdAt?: appCommonSchema$inst;
        deletedAt?: appCommonSchema$inst;
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
        createdAt?: appCommonSchema$inst;
        deletedAt?: appCommonSchema$inst;
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
      mainInstanceId: appCommonSchema$uuid;
      mainInstancePage: appCommonSchema$uuid;
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
        modifiedAt?: appCommonSchema$inst;
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
      tokenName: string;
      token: {
        id: appCommonSchema$uuid;
        name: string;
        /**
         * One of the Set
         */
        type: unknown;
        value: appCommonSchema$any;
        description?: string;
        modifiedAt?: appCommonSchema$inst;
      } | null;
    }
  | {
      type: 'set-base-font-size';
      baseFontSize: string;
    };
