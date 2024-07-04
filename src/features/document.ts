import { confirm } from '@inquirer/prompts';
import assert from 'assert';
import { kebabCase } from 'change-case';
import { camelCase } from 'change-case/keys';
import fsSync, { openAsBlob } from 'fs';
import fs from 'fs/promises';
import { glob } from 'glob';
import graphlib, { Graph } from 'graphlib';
import { mimeData } from 'human-filetypes';
import path from 'path';
import { Digraph, toDot } from 'ts-graphviz';
import { toFile } from 'ts-graphviz/adapter';
import { z } from 'zod';

import { GetFileResponse, getFileNodes, getImageFills } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings, postCommandGetFontVariants } from '@figpot/src/clients/penpot';
import {
  PostCommandGetFileResponse,
  appCommonFilesChanges$change,
  appCommonTypesTypography$typography,
  postCommandGetFile,
  postCommandRenameFile,
  postCommandUpdateFile,
} from '@figpot/src/clients/penpot';
import {
  FigmaDefinedColor,
  FigmaDefinedTypography,
  extractStylesTypographies,
  mergeStylesColors,
  retrieveColors,
  retrieveDocument,
} from '@figpot/src/features/figma';
import { cleanHostedDocument } from '@figpot/src/features/penpot';
import { transformDocumentNode } from '@figpot/src/features/transformers/transformDocumentNode';
import { isPageRootFrame, isPageRootFrameFromId, registerFontId, rootFrameId } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { formatDiffResultLog, getDiff } from '@figpot/src/utils/comparaison';
import { downloadFile } from '@figpot/src/utils/file';
import { gracefulExit } from '@figpot/src/utils/system';

const __root_dirname = process.cwd();

export const documentsFolderPath = path.resolve(__root_dirname, './data/documents/');
export const fontsFolderPath = path.resolve(__root_dirname, './data/fonts/');
export const mediasFolderPath = path.resolve(__root_dirname, './data/medias/');

export const FigmaToPenpotMapping = z.map(z.string(), z.string());
export type FigmaToPenpotMappingType = z.infer<typeof FigmaToPenpotMapping>;

export type LitePageNode = Pick<PenpotDocument['data']['pagesIndex'][0], 'id' | 'name' | 'options'> & { _apiType: 'page' };
export type LiteNode = PenpotNode & {
  _apiType: 'node';
  _realPageParentId: string | null; // Needed since main frame inside a page has as parent itself (which complicates things for our graph usage)
  _pageId: string; // Somes endpoints require the `pageId` to be specified so adding it for the ease when doing updates on nodes
};
export type LiteColor = Color & {
  _apiType: 'color';
};
export type LiteTypography = LibraryTypography & {
  _apiType: 'typography';
};
export type NodeLabel = LitePageNode | LiteNode | LiteColor | LiteTypography;

export const Mapping = z.object({
  lastExport: z.date().nullable(),
  fonts: FigmaToPenpotMapping,
  assets: FigmaToPenpotMapping,
  nodes: FigmaToPenpotMapping,
  documents: FigmaToPenpotMapping,
  colors: FigmaToPenpotMapping,
  typographies: FigmaToPenpotMapping,
});
export type MappingType = z.infer<typeof Mapping>;

export const Metadata = z.object({
  lastRetrieve: z.date(),
  // fonts: z.array(z.string()),
  // assets: ?,
  documentDependencies: z.array(z.string()),
});
export type MetadataType = z.infer<typeof Metadata>;

export const DocumentOptions = z.object({
  figmaDocument: z.string(),
  penpotDocument: z.string().optional(), // If empty a new file will be created
});
export type DocumentOptionsType = z.infer<typeof DocumentOptions>;

export const RetrieveOptions = z.object({
  documents: z.array(DocumentOptions),
});
export type RetrieveOptionsType = z.infer<typeof RetrieveOptions>;

export function getFigmaDocumentPath(documentId: string) {
  return path.resolve(documentsFolderPath, `figma_${documentId}`);
}

export function getFigmaDocumentTreePath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'tree.json');
}

export function getFigmaDocumentColorsPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'colors.json');
}

export function getFigmaDocumentTypographiesPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'typographies.json');
}

export function getPenpotDocumentPath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getFigmaDocumentPath(figmaDocumentId), 'export', `penpot_${penpotDocumentId}`);
}

export function getPenpotHostedDocumentTreePath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), 'hosted-tree.json');
}

export function getFigmaToPenpotMappingPath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), 'mapping.json');
}

export function getFigmaToPenpotDiffPath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), 'diff.json');
}

export function getTransformedFigmaTreePath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), 'transformed-tree.json');
}

export function getFigmaMediaPath(mediaId: string) {
  return path.resolve(mediasFolderPath, mediaId);
}

export async function readFigmaTreeFile(documentId: string): Promise<GetFileResponse> {
  const figmaTreePath = getFigmaDocumentTreePath(documentId);

  if (!fsSync.existsSync(figmaTreePath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${documentId}" before using any other command`);
  }

  const figmaTreeString = await fs.readFile(figmaTreePath, 'utf-8');

  return JSON.parse(figmaTreeString) as GetFileResponse; // We did not implement a zod schema, hoping they keep the structure stable enough
}

export async function readFigmaColorsFile(documentId: string): Promise<FigmaDefinedColor[]> {
  const figmaColorsPath = getFigmaDocumentColorsPath(documentId);

  if (!fsSync.existsSync(figmaColorsPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${documentId}" before using any other command`);
  }

  const figmaColorsString = await fs.readFile(figmaColorsPath, 'utf-8');

  return JSON.parse(figmaColorsString) as FigmaDefinedColor[];
}

export async function readFigmaTypographiesFile(documentId: string): Promise<FigmaDefinedTypography[]> {
  const figmaTypographiesPath = getFigmaDocumentTypographiesPath(documentId);

  if (!fsSync.existsSync(figmaTypographiesPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${documentId}" before using any other command`);
  }

  const figmaTypographiesString = await fs.readFile(figmaTypographiesPath, 'utf-8');

  return JSON.parse(figmaTypographiesString) as FigmaDefinedTypography[];
}

export async function readTransformedFigmaTreeFile(figmaDocumentId: string, penpotDocumentId: string): Promise<PenpotDocument> {
  const transformedFigmaTreePath = getTransformedFigmaTreePath(figmaDocumentId, penpotDocumentId);

  if (!fsSync.existsSync(transformedFigmaTreePath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${figmaDocumentId}" before using any other command`);
  }

  const transformedTreeString = await fs.readFile(transformedFigmaTreePath, 'utf-8');

  return JSON.parse(transformedTreeString) as PenpotDocument; // We did not implement a zod schema, hoping they keep the structure stable enough
}

export async function readFigmaToPenpotDiffFile(figmaDocumentId: string, penpotDocumentId: string): Promise<Differences> {
  const diffPath = getFigmaToPenpotDiffPath(figmaDocumentId, penpotDocumentId);

  if (!fsSync.existsSync(diffPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${figmaDocumentId}" before using any other command`);
  }

  const diffString = await fs.readFile(diffPath, 'utf-8');

  return JSON.parse(diffString) as Differences; // We did not implement a zod schema, hoping they keep the structure stable enough
}

export async function restoreMapping(figmaDocumentId: string, penpotDocumentId: string): Promise<MappingType> {
  const mappingPath = getFigmaToPenpotMappingPath(figmaDocumentId, penpotDocumentId);
  let mapping: MappingType | null = null;

  if (!fsSync.existsSync(mappingPath)) {
    // TODO: maybe add a warning if no node mapping?
    const answer = await confirm({
      message: `You target the Penpot document "${penpotDocumentId}" without having locally the mapping from previous synchronization. Are you sure to continue by overriding the target document?`,
    });

    if (!answer) {
      console.warn('the transformation operation has been aborted');

      return Promise.reject(gracefulExit);
    }
  } else {
    const mappingString = await fs.readFile(mappingPath, 'utf-8');
    const mappingJson = JSON.parse(mappingString);

    mapping = Mapping.parse({
      ...mappingJson,
      fonts: new Map(Object.entries(mappingJson.fonts)),
      assets: new Map(Object.entries(mappingJson.assets)),
      nodes: new Map(Object.entries(mappingJson.nodes)),
      documents: new Map(Object.entries(mappingJson.documents)),
      colors: new Map(Object.entries(mappingJson.colors)),
      typographies: new Map(Object.entries(mappingJson.typographies)),
    });
  }

  // If none, create a new one to be used
  if (!mapping) {
    await fs.mkdir(path.dirname(mappingPath), { recursive: true });

    mapping = {
      lastExport: null,
      fonts: new Map(),
      assets: new Map(),
      nodes: new Map(),
      documents: new Map(),
      colors: new Map(),
      typographies: new Map(),
    };
  }

  if (mapping.documents.size === 0) {
    mapping.documents.set('current', penpotDocumentId);
    mapping.documents.set(figmaDocumentId, penpotDocumentId);
  }

  return mapping;
}

export async function saveMapping(figmaDocumentId: string, penpotDocumentId: string, mapping: MappingType): Promise<void> {
  await fs.writeFile(
    getFigmaToPenpotMappingPath(figmaDocumentId, penpotDocumentId),
    JSON.stringify(
      {
        ...mapping,
        fonts: Object.fromEntries(mapping.fonts),
        assets: Object.fromEntries(mapping.assets),
        nodes: Object.fromEntries(mapping.nodes),
        documents: Object.fromEntries(mapping.documents),
        colors: Object.fromEntries(mapping.colors),
        typographies: Object.fromEntries(mapping.typographies),
      },
      null,
      2
    )
  );
}

export async function retrieve(options: RetrieveOptionsType) {
  for (const document of options.documents) {
    assert(document.penpotDocument);

    // Get all predefined colors from Figma
    // We do not use `getPublishedVariables()` because it contains only a part of the local ones, and without values
    // Note: other variable kinds are not retrieved because Penpot cannot manage them (so using their raw value)
    const figmaColors = await retrieveColors(document.figmaDocument);

    const customPenpotFontsVariants = (await postCommandGetFontVariants({
      requestBody: {
        fileId: document.penpotDocument,
      },
    })) as unknown as any[];

    const mapping = await restoreMapping(document.figmaDocument, document.penpotDocument);

    for (const customPenpotFontVariant of customPenpotFontsVariants) {
      const simulatedFigmaFontVariantId = `${customPenpotFontVariant.fontFamily}-${customPenpotFontVariant.fontStyle}-${customPenpotFontVariant.fontWeight}`;
      const penpotFontId = customPenpotFontVariant.fontId;

      registerFontId(simulatedFigmaFontVariantId, penpotFontId, mapping);
    }

    await saveMapping(document.figmaDocument, document.penpotDocument, mapping);

    // Save the document tree locally
    const documentTree = await retrieveDocument(document.figmaDocument);

    // Process attached styles
    const stylesIds: string[] = Object.keys(documentTree.styles);

    // The Figma API does not expose styles easily, so we have to use an endpoint to get simulated applied styles to extract wanted values
    // Ref: https://forum.figma.com/t/rest-api-get-color-and-text-styles/49216/4
    const styles = await getFileNodes({
      fileKey: document.figmaDocument,
      ids: stylesIds.join(','),
      depth: 1, // Should only return styles but just in case...
    });

    const figmaTypographies = extractStylesTypographies(documentTree, styles);
    mergeStylesColors(figmaColors, documentTree, styles);

    const documentFolderPath = getFigmaDocumentPath(document.figmaDocument);
    await fs.mkdir(documentFolderPath, { recursive: true });

    await fs.writeFile(getFigmaDocumentTreePath(document.figmaDocument), JSON.stringify(documentTree, null, 2));
    await fs.writeFile(getFigmaDocumentColorsPath(document.figmaDocument), JSON.stringify(figmaColors, null, 2));
    await fs.writeFile(getFigmaDocumentTypographiesPath(document.figmaDocument), JSON.stringify(figmaTypographies, null, 2));

    // Save images
    const imagesList = await getImageFills({
      fileKey: document.figmaDocument,
    });

    await fs.mkdir(mediasFolderPath, { recursive: true });

    for (const [figmaImageId, temporaryFileUrl] of Object.entries(imagesList.meta.images)) {
      const filePath = getFigmaMediaPath(figmaImageId);

      // It should always be the same extension so simplifying with the wildcard pattern
      // (the extension is retrieved from HTTP headers when downloading)
      const potentielExistingFilesPaths = await glob(`${filePath}.*`);

      // We assume uploaded images are immutable, so if locally existing, skip
      if (potentielExistingFilesPaths.length === 0) {
        console.log(`downloading the image ${figmaImageId} from Figma`);

        await downloadFile(temporaryFileUrl, filePath);
      }
    }
  }
}

export async function sortDocuments(documents: DocumentOptionsType[]): Promise<DocumentOptionsType[]> {
  // TODO: for now we test we only 1 document no having dependencies
  // but here we should take all meta.json file with dependencies of each and start by the one at the bottom with no children
  // then remove it, and take the one at the bottom with children, etc...
  assert(documents.length === 1);

  return documents;
}

export function transformDocument(
  documentTree: GetFileResponse,
  colors: FigmaDefinedColor[],
  typographies: FigmaDefinedTypography[],
  mapping: MappingType
) {
  // Go from the Figma format to the Penpot one
  const penpotTree = transformDocumentNode(documentTree, colors, typographies, mapping);

  return penpotTree;
}

export const TransformOptions = z.object({
  documents: z.array(DocumentOptions),
});
export type TransformOptionsType = z.infer<typeof TransformOptions>;

export async function transform(options: TransformOptionsType) {
  const orderedDocuments = sortDocuments(options.documents);

  // Go from the Figma format to the Penpot one
  for (const document of options.documents) {
    const figmaTree = await readFigmaTreeFile(document.figmaDocument);
    const figmaColors = await readFigmaColorsFile(document.figmaDocument);
    const figmaTypographies = await readFigmaTypographiesFile(document.figmaDocument);

    assert(document.penpotDocument);

    const mapping = await restoreMapping(document.figmaDocument, document.penpotDocument);

    const penpotTree = transformDocument(figmaTree, figmaColors, figmaTypographies, mapping);

    // Save mapping for later usage
    await saveMapping(document.figmaDocument, document.penpotDocument, mapping);

    await fs.writeFile(getTransformedFigmaTreePath(document.figmaDocument, document.penpotDocument), JSON.stringify(penpotTree, null, 2));
  }
}

export interface Differences {
  newDocumentName?: string;
  newTreeOperations: appCommonFilesChanges$change[];
  newMedias: string[];
}

export function getDifferences(currentTree: PenpotDocument, newTree: PenpotDocument): Differences {
  const newDocumentName = currentTree.name !== newTree.name ? newTree.name : undefined;
  const newMediasToUpload: string[] = [];

  // Flatten for comparaison (easier to get the differences of add/delete/modify/idle on the entire document)
  const flattenCurrentGlobalTree = new Map<string, NodeLabel>();
  const flattenNewGlobalTree: typeof flattenCurrentGlobalTree = new Map();

  // Below we use a graph logic to operate in the right order nodes (since moving/deleting/adding one can imply other)
  // [IMPORTANT] Edge `from` is the child whereas `to` is the parent
  const newGraph = new Graph();

  for (const currentPageNode of Object.values(currentTree.data.pagesIndex)) {
    flattenCurrentGlobalTree.set(currentPageNode.id, {
      _apiType: 'page',
      id: currentPageNode.id,
      name: currentPageNode.name,
      options: currentPageNode.options,
    } as LitePageNode);

    for (const currentNode of Object.values(currentPageNode.objects)) {
      assert(currentNode.id);

      flattenCurrentGlobalTree.set(currentNode.id, {
        _apiType: 'node',
        _realPageParentId: isPageRootFrame(currentNode) ? currentPageNode.id : null,
        _pageId: currentPageNode.id,
        ...currentNode,
      } as LiteNode);
    }
  }

  for (const currentColor of Object.values(currentTree.data.colors)) {
    assert(currentColor.id);

    flattenCurrentGlobalTree.set(currentColor.id, {
      _apiType: 'color',
      ...currentColor,
    } as LiteColor);
  }

  for (const currentTypography of Object.values(currentTree.data.typographies)) {
    assert(currentTypography.id);

    flattenCurrentGlobalTree.set(currentTypography.id, {
      _apiType: 'typography',
      ...currentTypography,
    } as LiteTypography);
  }

  for (const newPageNode of Object.values(newTree.data.pagesIndex)) {
    const litePageNode: LitePageNode = {
      _apiType: 'page',
      id: newPageNode.id,
      name: newPageNode.name,
      options: newPageNode.options,
    };

    flattenNewGlobalTree.set(litePageNode.id, litePageNode);
    newGraph.setNode(litePageNode.id, true); // No care about the content since we will take if from the diff

    for (const newNode of Object.values(newPageNode.objects)) {
      const liteNode: LiteNode = {
        _apiType: 'node',
        _realPageParentId: isPageRootFrame(newNode) ? newPageNode.id : null,
        _pageId: newPageNode.id,
        ...newNode,
      };

      assert(liteNode.id);
      assert(liteNode.parentId);

      flattenNewGlobalTree.set(liteNode.id, liteNode);
      newGraph.setNode(liteNode.id, true); // No care about the content since we will take if from the diff

      // Trying to add the edge between 2 nodes, if not existing it will "pre-create" the node without content
      // And into the next iterations (since all must be in the list) it will add the needed node content (it avoids looping 2 times)
      newGraph.setEdge(liteNode._realPageParentId || liteNode.parentId, liteNode.id);
    }
  }

  for (const newColor of Object.values(newTree.data.colors)) {
    assert(newColor.id);

    flattenNewGlobalTree.set(newColor.id, {
      _apiType: 'color',
      ...newColor,
    } as LiteColor);
  }

  for (const newTypography of Object.values(newTree.data.typographies)) {
    assert(newTypography.id);

    flattenNewGlobalTree.set(newTypography.id, {
      _apiType: 'typography',
      ...newTypography,
    } as LiteTypography);
  }

  const diffResult = getDiff(flattenCurrentGlobalTree, flattenNewGlobalTree);

  console.log(formatDiffResultLog(diffResult));

  const operations: appCommonFilesChanges$change[] = [];

  // Colors must be added/modified before the rest because they are primitives
  for (const [, item] of diffResult) {
    if (item.state === 'added') {
      if (item.after._apiType === 'color') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-color',
          color: {
            ...propertiesObj,
          },
        });
      } else if (item.after._apiType === 'typography') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-typography',
          typography: {
            ...propertiesObj,
          } as appCommonTypesTypography$typography, // Other types are unknown, we are fine here if the API triggers an error
        });
      }
    } else if (item.state === 'updated') {
      if (item.after._apiType === 'color') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'mod-color',
          color: {
            ...propertiesObj,
          },
        });
      } else if (item.after._apiType === 'typography') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'mod-typography',
          typography: {
            ...propertiesObj,
          } as appCommonTypesTypography$typography, // Other types are unknown, we are fine here if the API triggers an error
        });
      }
    }
  }

  const browse = (graphNodeId: string) => {
    const item = diffResult.get(graphNodeId);

    assert(item);

    if (item.state === 'added') {
      assert(item.after.id);

      if (item.after._apiType === 'page') {
        const { _apiType, id, name, options } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-page',
          id: id, // Penpot allows forcing the ID at creation
          name: name,
        });

        // The API refuses to take the `page` property directly with `add-page`, so hacking a bit
        for (const [optionKey, optionValue] of Object.entries(options)) {
          operations.push({
            type: 'set-option',
            pageId: id,
            option: kebabCase(optionKey), // Since it's a value we make sure to respect backend keywords logic
            value: optionValue,
          });
        }
      } else if (item.after._apiType === 'node') {
        const { _apiType, _realPageParentId, _pageId, frameId, id, mainInstance, parentId, ...propertiesObj } = item.after; // Instruction to omit some properties

        if (isPageRootFrame(item.after)) {
          // The root frame is automatically created with its wrapping page (the iteration before this one normally)
          // So we just need to apply modifications if needed
          operations.push({
            type: 'mod-obj',
            id: rootFrameId,
            pageId: _pageId,
            operations: (Object.keys(propertiesObj) as (keyof typeof propertiesObj)[])
              // No need to have the whole node differences patch logic since root frame can only have its colors customized
              .filter((p) => p === 'fills')
              .map((property) => {
                return {
                  type: 'set',
                  attr: kebabCase(property), // Since it's a value we make sure to respect backend keywords logic
                  val: propertiesObj[property],
                };
              }),
          });
        } else {
          assert(item.after.parentId);
          assert(item.after.frameId);

          operations.push({
            type: 'add-obj',
            id: item.after.id, // Penpot allows forcing the ID at creation
            pageId: item.after._realPageParentId || _pageId,
            frameId: isPageRootFrameFromId(item.after.frameId) ? rootFrameId : item.after.frameId,
            parentId: isPageRootFrameFromId(item.after.parentId) ? rootFrameId : item.after.parentId,
            obj: {
              ...propertiesObj,
            },
          });

          // Detect new images
          if (propertiesObj.fills) {
            for (const fill of propertiesObj.fills) {
              if (fill.fillImage?.id) {
                newMediasToUpload.push(fill.fillImage.id);
              }
            }
          }
        }
      }
    } else if (item.state === 'updated') {
      if (item.after._apiType === 'page') {
        operations.push({
          type: 'mod-page',
          id: item.after.id,
          name: item.after.name,
        });

        const { _apiType, id, name, ...propertiesObj } = item.after; // Instruction to omit some properties

        for (const difference of item.differences) {
          if (difference.path.length > 1 && difference.path[0] === 'options') {
            const optionKey = difference.path[1] as keyof PenpotPage['options'];

            operations.push({
              type: 'set-option',
              pageId: item.after.id,
              option: kebabCase(optionKey), // Since it's a value we make sure to respect backend keywords logic
              value:
                // Checking the property removal, also check the path length since an array item removal will produce a `REMOVE` too
                difference.type === 'REMOVE' && difference.path.length === 1 ? null : propertiesObj.options[optionKey],
            });
          }
        }
      } else if (item.after._apiType === 'node') {
        const { _apiType, _realPageParentId, _pageId, id, mainInstance, ...propertiesObj } = item.after; // Instruction to omit some properties

        assert(id);

        // No matter if the difference is a creation/change/removal, it's committed the same way
        const changedFirstLevelProperties: (keyof typeof propertiesObj)[] = [];
        for (const difference of item.differences) {
          if (difference.path.length > 0) {
            const propertyToSet = difference.path[0];

            // A value reset must be done by `null`
            // Note: we have `undefined` in our comparaison since the backend does not return this as value, so forcing the reset value
            if (difference.type === 'REMOVE' && difference.path.length === 1) {
              // Checking the property removal, also check the path length since an array item removal will produce a `REMOVE` too
              (propertiesObj as any)[propertyToSet] = null;
            }

            if (Object.hasOwn(propertiesObj, propertyToSet)) {
              // We exclude differences that have been deconstructed from the initial object
              changedFirstLevelProperties.push(propertyToSet as keyof typeof propertiesObj);
            }

            // Detect new images by looking at the expected path that should be concerned
            // Note: it's possible it has been already uploaded but doing it a new time will be rare with no consequence
            if (
              difference.path.length >= 2 &&
              (difference.type === 'CREATE' || difference.type === 'CHANGE') &&
              difference.path[difference.path.length - 2] === 'fillImage' &&
              difference.path[difference.path.length - 1] === 'id'
            ) {
              newMediasToUpload.push(difference.value as string);
            } else if (
              difference.path.length >= 1 &&
              (difference.type === 'CREATE' || difference.type === 'CHANGE') &&
              difference.path[difference.path.length - 1] === 'fillImage'
            ) {
              newMediasToUpload.push(difference.value.id as string);
            }
          }
        }

        const uniqueProperties = [...new Set(changedFirstLevelProperties)];

        operations.push({
          type: 'mod-obj',
          id: isPageRootFrameFromId(id) ? rootFrameId : id,
          pageId: _pageId,
          operations: uniqueProperties.map((property) => {
            return {
              type: 'set',
              attr: kebabCase(property), // Since it's a value we make sure to respect backend keywords logic (otherwise we ended having 2 `transformInverse` (the initial one, and one from our update))
              val:
                (property === 'parentId' || property === 'frameId') && isPageRootFrameFromId(propertiesObj[property] as string)
                  ? rootFrameId
                  : propertiesObj[property],
            };
          }),
        });
      }
    }

    const children = newGraph.successors(graphNodeId);

    if (children && children?.length > 0) {
      for (const childId of children) {
        browse(childId);
      }
    }
  };

  const sourcesIds = newGraph.sources();
  for (const sourceId of sourcesIds) {
    browse(sourceId);
  }

  // Delete others (those should be orphan into the document now)
  for (const [, item] of diffResult) {
    if (item.state === 'removed') {
      if (item.before._apiType === 'page') {
        operations.push({
          type: 'del-page',
          id: item.before.id,
        });
      } else if (item.before._apiType === 'node') {
        operations.push({
          type: 'del-obj',
          id: isPageRootFrame(item.before) ? rootFrameId : item.before.id,
          pageId: item.before._pageId,
        });
      } else if (item.before._apiType === 'color') {
        operations.push({
          type: 'del-color',
          id: item.before.id,
        });
      } else if (item.before._apiType === 'typography') {
        operations.push({
          type: 'del-typography',
          id: item.before.id,
        });
      }
    }
  }

  return {
    newDocumentName: newDocumentName,
    newTreeOperations: operations,
    newMedias: [...new Set(newMediasToUpload)], // Remove duplicates
  };
}

export const CompareOptions = z.object({
  documents: z.array(DocumentOptions),
});
export type CompareOptionsType = z.infer<typeof CompareOptions>;

export async function compare(options: CompareOptionsType) {
  // Take the Penpot one that has Figma node IDs and use the one from the mappings
  // Get documents from Penpot if already synchronized in the past
  // Calculate operations needed on the current hosted tree to match the Figma documents state
  for (const document of options.documents) {
    const figmaDocumentFolderPath = getFigmaDocumentPath(document.figmaDocument);
    let figmaDocumentFolderExists = fsSync.existsSync(figmaDocumentFolderPath);

    if (!figmaDocumentFolderExists) {
      throw new Error('figma document not existing locally, make sure to trigger commands in the right order');
    } else if (!document.penpotDocument) {
      throw new Error(
        `TODO: should create a new document, and be sure it's passed to next function, or change the logic to return raw data, not just files`
      );
    }

    let hostedDocument = await postCommandGetFile({
      requestBody: {
        id: document.penpotDocument,
      },
    });

    // TODO: for now the response is kebab-case despite types, so forcing the conversion (ref: https://github.com/penpot/penpot/pull/4760#pullrequestreview-2125984653)
    hostedDocument = camelCase(hostedDocument, Number.MAX_SAFE_INTEGER) as PostCommandGetFileResponse;

    const penpotDocumentFolderPath = getPenpotDocumentPath(document.figmaDocument, document.penpotDocument);
    await fs.mkdir(penpotDocumentFolderPath, { recursive: true });

    await fs.writeFile(getPenpotHostedDocumentTreePath(document.figmaDocument, document.penpotDocument), JSON.stringify(hostedDocument, null, 2));

    const transformedDocument = await readTransformedFigmaTreeFile(document.figmaDocument, document.penpotDocument);

    const hostedCoreDocument = cleanHostedDocument(hostedDocument);
    const diff = getDifferences(hostedCoreDocument, transformedDocument);

    await fs.writeFile(getFigmaToPenpotDiffPath(document.figmaDocument, document.penpotDocument), JSON.stringify(diff, null, 2));
  }
}

export async function processDifferences(figmaDocumentId: string, penpotDocumentId: string, differences: Differences) {
  if (differences.newDocumentName) {
    await postCommandRenameFile({
      requestBody: {
        id: penpotDocumentId,
        name: differences.newDocumentName,
      },
    });
  }

  // We first upload files because they are used by nodes
  if (differences.newMedias.length > 0) {
    // Retrieve the original Figma IDs to upload files
    const mapping = await restoreMapping(figmaDocumentId, penpotDocumentId);

    for (const penpotMediaId of differences.newMedias) {
      // We check all files we need to use have been retrieved locally before
      let figmaMediaId: string | null = null;

      for (const [itemFigmaMediaId, itemPenpotMediaId] of mapping.assets.entries()) {
        if (itemPenpotMediaId === penpotMediaId) {
          figmaMediaId = itemFigmaMediaId;

          break;
        }
      }

      if (!figmaMediaId) {
        throw new Error(`the Penpot file ${penpotMediaId} must have been mapped previously to be uploaded`);
      }

      const filePath = getFigmaMediaPath(figmaMediaId);
      const potentielExistingFilesPaths = await glob(`${filePath}.*`);

      if (!potentielExistingFilesPaths.length) {
        throw new Error(`the Figma file ${figmaMediaId} cannot be uploaded to Penpot since missing locally`);
      }

      const fileToUploadPath = potentielExistingFilesPaths[0];
      const filename = path.basename(fileToUploadPath);
      const fileExtension = `.${filename.split('.')[1] ?? ''}`;

      let fileMimeType: string | null = null;
      for (const [mimeType, mimeTypeMetadata] of Object.entries(mimeData)) {
        if (mimeTypeMetadata.extensions && mimeTypeMetadata.extensions.findIndex((ext) => ext === fileExtension) !== -1) {
          fileMimeType = mimeType;

          break;
        }
      }

      assert(fileMimeType);

      const blob = await openAsBlob(fileToUploadPath, {
        // For whatever reason it returns an empty MIME type, so patching it manually
        // Ref: https://github.com/nodejs/node/issues/49843
        type: fileMimeType,
      });

      const formData = new FormData();
      formData.append('id', penpotMediaId);
      formData.append('file-id', penpotDocumentId);
      formData.append('name', 'unknown'); // We cannot retrieve the original filename from Figma so forcing a random one
      formData.append('is-local', 'false');
      formData.append('content', blob);

      console.log(`uploading the media ${penpotMediaId} to Penpot`);

      const response = await fetch(`${PenpotClientSettings.BASE}/command/upload-file-media-object`, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          Authorization: (PenpotClientSettings.HEADERS as any)?.Authorization,
        },
      });

      if (response.status !== 200) {
        throw new Error(`the media ${penpotMediaId} seems to not be uploaded correctly`);
      }

      const data = (await response.json()) as any;

      if (!data.createdAt) {
        throw new Error(`the media ${penpotMediaId} seems to not be uploaded correctly`);
      }
    }
  }

  if (differences.newTreeOperations.length > 0) {
    await postCommandUpdateFile({
      requestBody: {
        id: penpotDocumentId,
        revn: 1, // Required but does no block to use a default one
        sessionId: '00000000-0000-0000-0000-000000000000', // It has to be UUID format, no matter the value for us
        changes: differences.newTreeOperations,
      },
    });
  }
}

export const SetOptions = z.object({
  documents: z.array(DocumentOptions),
});
export type SetOptionsType = z.infer<typeof SetOptions>;

export async function set(options: SetOptionsType) {
  // Execute operations onto Penpot instance to match the Figma documents
  // and adjust local mapping with deleted/modified/created nodes
  for (const document of options.documents) {
    assert(document.penpotDocument);

    const diff = await readFigmaToPenpotDiffFile(document.figmaDocument, document.penpotDocument);

    await processDifferences(document.figmaDocument, document.penpotDocument, diff);
  }
}

export const SynchronizeOptions = z.object({
  documents: z.array(DocumentOptions),
});
export type SynchronizeOptionsType = z.infer<typeof SynchronizeOptions>;

export async function synchronize(options: SynchronizeOptionsType) {
  // TODO: compute the entire node tree
  await retrieve(options);

  // TODO: then
  await transform(options);
  await compare(options);
  await set(options);
}
