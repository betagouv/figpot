import { confirm } from '@inquirer/prompts';
import assert from 'assert';
import { kebabCase } from 'change-case';
import { camelCase } from 'change-case/keys';
import fsSync, { openAsBlob } from 'fs';
import fs from 'fs/promises';
import { glob } from 'glob';
import graphlib, { Graph } from 'graphlib';
import { mimeData } from 'human-filetypes';
import { parse, toSeconds } from 'iso8601-duration';
import arrayDiff from 'microdiff';
import path from 'path';
import { Request, chromium } from 'playwright';
import setCookieParser from 'set-cookie-parser';
import { parser } from 'stream-json';
import { Digraph, toDot } from 'ts-graphviz';
import { toFile } from 'ts-graphviz/adapter';
import { z } from 'zod';

import { GetFileResponse, getImageFills } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings, postCommandGetFileObjectThumbnails, postCommandGetFontVariants } from '@figpot/src/clients/penpot';
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
  countTotalElements,
  extractStylesTypographies,
  mergeStylesColors,
  patchDocument,
  retrieveColors,
  retrieveDocument,
  retrieveStylesNodes,
} from '@figpot/src/features/figma';
import { cleanHostedDocument } from '@figpot/src/features/penpot';
import { transformDocumentNode } from '@figpot/src/features/transformers/transformDocumentNode';
import { isPageRootFrame, isPageRootFrameFromId, registerFontId, rootFrameId } from '@figpot/src/features/translators/translateId';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { formatDiffResultLog, getDiff } from '@figpot/src/utils/comparaison';
import { config } from '@figpot/src/utils/environment';
import { downloadFile, readBigJsonFile, writeBigJsonFile } from '@figpot/src/utils/file';
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
export type LiteComponent = LibraryComponent & {
  _apiType: 'component';
};
export type NodeLabel = LitePageNode | LiteNode | LiteColor | LiteTypography | LiteComponent;

export const Mapping = z.object({
  lastExport: z.date().nullable(),
  fonts: FigmaToPenpotMapping,
  assets: FigmaToPenpotMapping,
  nodes: FigmaToPenpotMapping,
  documents: FigmaToPenpotMapping,
  colors: FigmaToPenpotMapping,
  typographies: FigmaToPenpotMapping,
  components: FigmaToPenpotMapping,
});
export type MappingType = z.infer<typeof Mapping>;

export const Metadata = z.object({
  figmaDocumentId: z.string(),
  figmaLastModified: z.string().pipe(z.coerce.date()),
  penpotProjectId: z.string(),
  penpotDocumentId: z.string(),
  penpotLastModified: z.string().pipe(z.coerce.date()),
  penpotPages: z.array(z.string().uuid()),
});
export type MetadataType = z.infer<typeof Metadata>;

export const DocumentOptions = z.object({
  figmaDocument: z.string(),
  penpotDocument: z.string(),
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

export function getFigmaToPenpotMetaPath(figmaDocumentId: string, penpotDocumentId: string) {
  return path.resolve(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), 'meta.json');
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

  return (await readBigJsonFile(figmaTreePath)) as GetFileResponse; // We did not implement a zod schema, hoping they keep the structure stable enough
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

  return (await readBigJsonFile(transformedFigmaTreePath)) as PenpotDocument; // We did not implement a zod schema, hoping they keep the structure stable enough
}

export async function readFigmaToPenpotDiffFile(figmaDocumentId: string, penpotDocumentId: string): Promise<Differences> {
  const diffPath = getFigmaToPenpotDiffPath(figmaDocumentId, penpotDocumentId);

  if (!fsSync.existsSync(diffPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${figmaDocumentId}" before using any other command`);
  }

  return (await readBigJsonFile(diffPath)) as Differences; // We did not implement a zod schema, hoping they keep the structure stable enough
}

export async function restoreMeta(figmaDocumentId: string, penpotDocumentId: string): Promise<MetadataType> {
  const metaPath = getFigmaToPenpotMetaPath(figmaDocumentId, penpotDocumentId);
  let meta: MetadataType | null = null;

  if (fsSync.existsSync(metaPath)) {
    const metaString = await fs.readFile(metaPath, 'utf-8');
    const metaJson = JSON.parse(metaString);

    meta = Metadata.parse(metaJson);
  }

  // If none, create a new one to be used
  // Note: we use meaningless values just to respect the typings
  if (!meta) {
    await fs.mkdir(path.dirname(metaPath), { recursive: true });

    meta = {
      figmaDocumentId: figmaDocumentId,
      figmaLastModified: new Date(0),
      penpotProjectId: 'not_known_yet',
      penpotDocumentId: 'not_known_yet',
      penpotLastModified: new Date(0),
      penpotPages: [],
    };
  }

  return meta;
}

export async function saveMeta(figmaDocumentId: string, penpotDocumentId: string, meta: MetadataType): Promise<void> {
  await fs.writeFile(getFigmaToPenpotMetaPath(figmaDocumentId, penpotDocumentId), JSON.stringify(meta, null, 2), {
    encoding: 'utf-8',
  });
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
      components: new Map(Object.entries(mappingJson.components)),
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
      components: new Map(),
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
        components: Object.fromEntries(mapping.components),
      },
      null,
      2
    ),
    {
      encoding: 'utf-8',
    }
  );
}

export async function retrieve(options: RetrieveOptionsType) {
  for (const document of options.documents) {
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

    // Use metadata for future usage
    const meta = await restoreMeta(document.figmaDocument, document.penpotDocument);
    meta.figmaDocumentId = documentTree.mainFileKey || document.figmaDocument;
    meta.figmaLastModified = new Date(documentTree.lastModified);
    await saveMeta(document.figmaDocument, document.penpotDocument, meta);

    // Process attached styles
    const stylesIds: string[] = Object.keys(documentTree.styles);

    // The Figma API does not expose styles easily, so we have to use an endpoint to get simulated applied styles to extract wanted values
    // Ref: https://forum.figma.com/t/rest-api-get-color-and-text-styles/49216/4
    const stylesNodes = await retrieveStylesNodes(document.figmaDocument, stylesIds);

    const figmaTypographies = extractStylesTypographies(documentTree, stylesNodes);
    mergeStylesColors(figmaColors, documentTree, stylesNodes);

    const documentFolderPath = getFigmaDocumentPath(document.figmaDocument);
    await fs.mkdir(documentFolderPath, { recursive: true });

    await writeBigJsonFile(getFigmaDocumentTreePath(document.figmaDocument), documentTree);
    await fs.writeFile(getFigmaDocumentColorsPath(document.figmaDocument), JSON.stringify(figmaColors, null, 2), {
      encoding: 'utf-8',
    });
    await fs.writeFile(getFigmaDocumentTypographiesPath(document.figmaDocument), JSON.stringify(figmaTypographies, null, 2), {
      encoding: 'utf-8',
    });

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

export const Pattern = z.string().transform((val) => {
  // We make it case insensitive because in huge files sometimes common patterns are not exact
  return new RegExp(val, 'i');
});
export type PatternType = z.infer<typeof Pattern>;

export const ExcludePatterns = z.object({
  pageNamePatterns: z.array(Pattern).optional(),
  nodeNamePatterns: z.array(Pattern).optional(),
  componentNamePatterns: z.array(Pattern).optional(),
  typographyNamePatterns: z.array(Pattern).optional(),
  colorNamePatterns: z.array(Pattern).optional(),
});
export type ExcludePatternsType = z.infer<typeof ExcludePatterns>;

export const ReplaceFontPattern = z.object({
  search: Pattern,
  set: z.string().min(1),
});
export type ReplaceFontPatternType = z.infer<typeof ReplaceFontPattern>;

export const TransformOptions = z.object({
  documents: z.array(DocumentOptions),
  excludePatterns: ExcludePatterns,
  replaceFontPatterns: z.array(ReplaceFontPattern),
});
export type TransformOptionsType = z.infer<typeof TransformOptions>;

export async function transform(options: TransformOptionsType) {
  const orderedDocuments = sortDocuments(options.documents);

  // Go from the Figma format to the Penpot one
  for (const document of options.documents) {
    const figmaTree = await readFigmaTreeFile(document.figmaDocument);
    const figmaColors = await readFigmaColorsFile(document.figmaDocument);
    const figmaTypographies = await readFigmaTypographiesFile(document.figmaDocument);

    patchDocument(figmaTree, figmaColors, figmaTypographies, options.excludePatterns, options.replaceFontPatterns);

    const elementsCount = countTotalElements(figmaTree, figmaColors, figmaTypographies);

    console.log(`the figma document contains around ${elementsCount} elements`);

    const advisedElementsLimit = 150_000;
    if (elementsCount > advisedElementsLimit) {
      const answer = await confirm({
        message: `The Figma document tree you want to synchronize is really huge. Over ${advisedElementsLimit} elements we are quick sure both the Penpot backend and the frontend won't be able to render your document until Penpot evolves. Have a look at our documentation see how to exclude nodes that brings to you no value and that could make the document loadable. Do you want to by-pass this warning and continue processing an unloadable file?`,
      });

      if (!answer) {
        console.warn('the transformation operation has been aborted');

        return Promise.reject(gracefulExit);
      }
    }

    const mapping = await restoreMapping(document.figmaDocument, document.penpotDocument);

    const penpotTree = transformDocument(figmaTree, figmaColors, figmaTypographies, mapping);

    // Save mapping for later usage
    await saveMapping(document.figmaDocument, document.penpotDocument, mapping);

    await writeBigJsonFile(getTransformedFigmaTreePath(document.figmaDocument, document.penpotDocument), penpotTree);
  }
}

export interface Differences {
  newDocumentName?: string;
  newTreeOperations: appCommonFilesChanges$change[];
  newMedias: string[];
  oldThumbnails: string[];
}

export function pushOperationsWithOrderingLogic(
  normalOperations: appCommonFilesChanges$change[],
  delayedOperations: appCommonFilesChanges$change[],
  delayedForChildrenOperations: appCommonFilesChanges$change[],
  operationToAddress: appCommonFilesChanges$change
) {
  if (operationToAddress.type === 'mod-obj') {
    // A shapes modification may fail with `referential-integrity` error, it needs to be performed once the children are set up
    // We have to deduplicate the logic by extracting this
    const suboperationToSwitch = operationToAddress.operations.findIndex((suboperation) => {
      return suboperation.type === 'set' && suboperation.attr === 'shapes' && (suboperation.val as string[]).length > 0;
    });

    if (suboperationToSwitch !== -1) {
      delayedForChildrenOperations.push({
        type: operationToAddress.type,
        id: operationToAddress.id,
        pageId: operationToAddress.pageId,
        operations: [operationToAddress.operations[suboperationToSwitch]],
      });

      operationToAddress.operations.splice(suboperationToSwitch, 1);
    }

    // If no more operation for the original one we can skip it because if `pageId` has changed it would be handled by the second one
    if (operationToAddress.operations.length > 0) {
      normalOperations.push(operationToAddress);
    }
  } else if (operationToAddress.type === 'add-obj') {
    if ((operationToAddress.obj as any).shapes && (operationToAddress.obj as any).shapes.length > 0) {
      delayedForChildrenOperations.push({
        type: 'mod-obj',
        id: operationToAddress.id,
        pageId: operationToAddress.pageId,
        operations: [
          {
            type: 'set',
            attr: 'shapes',
            val: (operationToAddress.obj as any).shapes,
          },
        ],
      });

      (operationToAddress.obj as any).shapes = []; // Set the initial one sinc erequired
    }

    normalOperations.push(operationToAddress);
  } else {
    normalOperations.push(operationToAddress);
  }
}

export function delayBindingOperation(
  delayedOperations: appCommonFilesChanges$change[],
  nodeId?: string,
  pageId?: string,
  componentId?: string,
  componentFile?: string,
  componentRoot?: boolean,
  mainInstance?: boolean,
  shapeRef?: string
) {
  // Sometimes the API requires the targeted node by `shapeRef` to be created before (sometimes not)
  // So we decided to delay all bindings to be sure locally all main component instances exist
  // Note: maybe it happens since we chunk operations for large documents
  // Note: we have to delay all component stuff otherwise the API invalidates the input
  const delayedOperation: appCommonFilesChanges$change = {
    type: 'mod-obj',
    id: nodeId,
    pageId: pageId,
    operations: [],
  };

  // A main instance has no `shapeRef`, and the API refuses it if `null/undefined` so using conditions to avoid triggering a backend calculation
  if (componentId !== undefined) {
    delayedOperation.operations.push({ type: 'set', attr: kebabCase('componentId'), val: componentId });
  }
  if (componentFile !== undefined) {
    delayedOperation.operations.push({ type: 'set', attr: kebabCase('componentFile'), val: componentFile });
  }
  if (componentRoot !== undefined) {
    delayedOperation.operations.push({ type: 'set', attr: kebabCase('componentRoot'), val: componentRoot });
  }
  if (mainInstance !== undefined) {
    delayedOperation.operations.push({ type: 'set', attr: kebabCase('mainInstance'), val: mainInstance });
  }
  if (shapeRef !== undefined) {
    delayedOperation.operations.push({ type: 'set', attr: kebabCase('shapeRef'), val: shapeRef });
  }

  delayedOperations.push(delayedOperation);
}

export function formatThumbnailId(documentId: string, pageId: string, objectId: string, objectType: 'component' | 'frame') {
  return `${documentId}/${pageId}/${objectId}/${objectType}`;
}

export function markThumbnailToBeKept(
  thumbnailsToKeep: Set<string>,
  documentId: string,
  pageId: string,
  objectId: string,
  objectType: 'component' | 'frame'
) {
  const thumbnailId = formatThumbnailId(documentId, pageId, objectId, objectType);

  thumbnailsToKeep.add(thumbnailId);
}

export function performBasicNodeCreation(
  normalOperations: appCommonFilesChanges$change[],
  delayedOperations: appCommonFilesChanges$change[],
  delayedForChildrenOperations: appCommonFilesChanges$change[],
  newMediasToUpload: string[],
  itemAfter: LiteNode,
  previousNodeIdBeforeMove?: string
) {
  const {
    _apiType,
    _realPageParentId,
    _pageId,
    frameId,
    id,
    parentId,
    componentId,
    componentFile,
    componentRoot,
    mainInstance,
    shapeRef,
    ...propertiesObj
  } = itemAfter; // Instruction to omit some properties

  assert(itemAfter.parentId);
  assert(itemAfter.frameId);

  const operation: appCommonFilesChanges$change = {
    type: 'add-obj',
    id: itemAfter.id, // Penpot allows forcing the ID at creation
    pageId: itemAfter._realPageParentId || _pageId,
    frameId: isPageRootFrameFromId(itemAfter.frameId) ? rootFrameId : itemAfter.frameId,
    parentId: isPageRootFrameFromId(itemAfter.parentId) ? rootFrameId : itemAfter.parentId,
    obj: {
      ...propertiesObj,
      oldId: previousNodeIdBeforeMove, // Can be used by the Penpot internals, specific to operations when an object is moved across pages (with cut/paste)
    },
  };

  pushOperationsWithOrderingLogic(normalOperations, delayedOperations, delayedForChildrenOperations, operation);

  if (componentId || componentFile || componentRoot || mainInstance || shapeRef) {
    delayBindingOperation(delayedOperations, id, _pageId, componentId, componentFile, componentRoot, mainInstance, shapeRef);
  }

  // Detect new images
  if (propertiesObj.fills) {
    for (const fill of propertiesObj.fills) {
      if (fill.fillImage?.id) {
        newMediasToUpload.push(fill.fillImage.id);
      }
    }
  }
}

export function getDifferences(documentId: string, currentTree: PenpotDocument, newTree: PenpotDocument, currentThumbnails: string[]): Differences {
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

  if (currentTree.data.colors) {
    for (const currentColor of Object.values(currentTree.data.colors)) {
      assert(currentColor.id);

      flattenCurrentGlobalTree.set(currentColor.id, {
        _apiType: 'color',
        ...currentColor,
      } as LiteColor);
    }
  }

  if (currentTree.data.typographies) {
    for (const currentTypography of Object.values(currentTree.data.typographies)) {
      assert(currentTypography.id);

      flattenCurrentGlobalTree.set(currentTypography.id, {
        _apiType: 'typography',
        ...currentTypography,
      } as LiteTypography);
    }
  }

  if (currentTree.data.components) {
    for (const currentComponent of Object.values(currentTree.data.components)) {
      assert(currentComponent.id);

      flattenCurrentGlobalTree.set(currentComponent.id, {
        _apiType: 'component',
        ...currentComponent,
      } as LiteComponent);
    }
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

  if (newTree.data.colors) {
    for (const newColor of Object.values(newTree.data.colors)) {
      assert(newColor.id);

      flattenNewGlobalTree.set(newColor.id, {
        _apiType: 'color',
        ...newColor,
      } as LiteColor);
    }
  }

  if (newTree.data.typographies) {
    for (const newTypography of Object.values(newTree.data.typographies)) {
      assert(newTypography.id);

      flattenNewGlobalTree.set(newTypography.id, {
        _apiType: 'typography',
        ...newTypography,
      } as LiteTypography);
    }
  }

  if (newTree.data.components) {
    for (const newComponent of Object.values(newTree.data.components)) {
      assert(newComponent.id);

      flattenNewGlobalTree.set(newComponent.id, {
        _apiType: 'component',
        ...newComponent,
      } as LiteComponent);
    }
  }

  const diffResult = getDiff(flattenCurrentGlobalTree, flattenNewGlobalTree);

  console.log(`[nodes differences] ${formatDiffResultLog(diffResult)}`);

  const operations: appCommonFilesChanges$change[] = [];
  const thumbnailsToKeep: Set<string> = new Set(); // Thumbails are only done on top frame for each tree branch (page deletion does not trigger thumbnail removal)
  const delayedOperations: typeof operations = [];

  for (const [, item] of diffResult) {
    if (item.state === 'removed') {
      // Components must be deleted before we delete its nodes from the normal tree
      // Otherwise it corrupts the global document and there is no way to fix it
      // (trying to delete the node after results in an issue saying `objects` into the component must exist. This should be the saved definition nodes for soft deletion... cannot be patched)
      if (item.before._apiType === 'component') {
        operations.push({
          type: 'del-component',
          id: item.before.id,
          skipUndelete: true, // Should prevent the soft delete but not working...
        });
      }
    }
  }

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
      } else if (item.after._apiType === 'component') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-component',
          ...(propertiesObj as any), // Types do not match due to OpenAPI schema, which is also missing `mainInstancePage/mainInstanceId`
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
      } else if (item.after._apiType === 'component') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'mod-component',
          id: item.after.id,
          name: item.after.name,
          ...{
            // Needed due to missing type property
            path: item.after.path,
          },
        });
      }
    }
  }

  const browse = (
    graphNodeId: string,
    foundTopBranchFrame: boolean // This excludes the root frame
  ): boolean => {
    // Returns in case of modifications
    const item = diffResult.get(graphNodeId);

    assert(item);

    let subTreeModified = false;
    let topBranchFrame: LiteNode | null = null;
    if (!foundTopBranchFrame) {
      let node: NodeLabel | null = null;
      if (item.state === 'unchanged') {
        node = item.model;
      } else if (item.state !== 'removed') {
        node = item.after;
      }

      if (node && node._apiType === 'node' && node.type === 'frame' && !isPageRootFrameFromId(node.id as string)) {
        foundTopBranchFrame = true;
        topBranchFrame = node;
      }
    }

    const nodeOperationsAfterChildrenAreProcessed: appCommonFilesChanges$change[] = [];

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
        if (isPageRootFrame(item.after)) {
          const { _apiType, _realPageParentId, _pageId, frameId, id, parentId, ...propertiesObj } = item.after; // Instruction to omit some properties

          // The root frame is automatically created with its wrapping page (the iteration before this one normally)
          // So we just need to apply modifications if needed
          const operation: appCommonFilesChanges$change = {
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
          };

          pushOperationsWithOrderingLogic(operations, delayedOperations, nodeOperationsAfterChildrenAreProcessed, operation);
        } else {
          performBasicNodeCreation(operations, delayedOperations, nodeOperationsAfterChildrenAreProcessed, newMediasToUpload, item.after);
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
                difference.type === 'REMOVE' && difference.path.length === 2 ? null : propertiesObj.options[optionKey],
            });
          }
        }
      } else if (item.after._apiType === 'node') {
        const { _apiType, _realPageParentId, _pageId, id, componentId, componentFile, componentRoot, mainInstance, shapeRef, ...propertiesObj } =
          item.after; // Instruction to omit some properties

        assert(id);

        // Penpot does not handle moving objects across pages
        // So to handle this we use a combination of a deletion and a creation
        // Note: only objects can be moved, not the root frame so not handlind this complex logic
        if (item.before._apiType === 'node' && item.before._pageId !== item.after._pageId) {
          operations.push({
            type: 'del-obj',
            id: item.before.id,
            pageId: item.before._pageId,
          });

          performBasicNodeCreation(
            operations,
            delayedOperations,
            nodeOperationsAfterChildrenAreProcessed,
            newMediasToUpload,
            item.after,
            item.before.id
          );
        } else {
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

              // A few cases objects makes impossible to modify the `parent-id` and `frame-id` (e.g. when having a variant inside it's component set, and we move the variant outside the group)
              // The triggered error is `error on validating file referential integrity`
              // The only workaround found is to prepare the move another way (maybe not perfect and a bit of duplicating work but it works)
              if (difference.path.length === 1 && difference.type === 'CHANGE' && difference.path[0] === 'parentId') {
                operations.push({
                  type: 'mov-objects',
                  shapes: [item.after.id], // Object needed to change its parent
                  pageId: item.after._realPageParentId || _pageId,
                  parentId: isPageRootFrameFromId(difference.value) ? rootFrameId : difference.value,
                });
              }
            }
          }

          const uniqueProperties = [...new Set(changedFirstLevelProperties)];

          const operation: appCommonFilesChanges$change = {
            type: 'mod-obj',
            id: isPageRootFrameFromId(id) ? rootFrameId : id,
            pageId: _pageId,
            operations: uniqueProperties.map((property) => {
              // The `touched` property has a specific operation format
              if (property === 'touched') {
                return {
                  type: 'set-touched',
                  touched: propertiesObj.touched || null,
                };
              } else {
                return {
                  type: 'set',
                  attr: kebabCase(property), // Since it's a value we make sure to respect backend keywords logic (otherwise we ended having 2 `transformInverse` (the initial one, and one from our update))
                  val:
                    (property === 'parentId' || property === 'frameId') && isPageRootFrameFromId(propertiesObj[property] as string)
                      ? rootFrameId
                      : propertiesObj[property],
                };
              }
            }),
          };

          pushOperationsWithOrderingLogic(operations, delayedOperations, nodeOperationsAfterChildrenAreProcessed, operation);

          if (
            item.before._apiType === 'node' &&
            (item.before.componentId !== item.after.componentId ||
              item.before.componentFile !== item.after.componentFile ||
              item.before.componentRoot !== item.after.componentRoot ||
              item.before.mainInstance !== item.after.mainInstance ||
              item.before.shapeRef !== item.after.shapeRef)
          ) {
            delayBindingOperation(delayedOperations, id, _pageId, componentId, componentFile, componentRoot, mainInstance, shapeRef);
          }
        }
      }
    }

    const children = newGraph.successors(graphNodeId);

    if (children && children?.length > 0) {
      for (const childId of children) {
        const childTreeModified = browse(childId, foundTopBranchFrame);

        if (childTreeModified) {
          subTreeModified = true;
        }
      }
    }

    // If the children tree has been modified in a way we require the thumbnail refresh
    if (topBranchFrame && !subTreeModified) {
      assert(topBranchFrame.id);

      markThumbnailToBeKept(thumbnailsToKeep, documentId, topBranchFrame._pageId, topBranchFrame.id, 'frame');

      // If the frame is also a component definition, it has also its thumbnail for library usage
      if (topBranchFrame.mainInstance) {
        markThumbnailToBeKept(thumbnailsToKeep, documentId, topBranchFrame._pageId, topBranchFrame.id, 'component');
      }
    }

    // The API expects a specific order of execution
    operations.push(...nodeOperationsAfterChildrenAreProcessed);

    return subTreeModified;
  };

  const sourcesIds = newGraph.sources();
  for (const sourceId of sourcesIds) {
    browse(sourceId, false);
  }

  // The API expects some bindings to have all nodes created, so running them at the end
  // Note: cannot use `.push(...delayedOperations)` because for huge files it goes over JavaScript parameters length limit
  for (const delayedOperation of delayedOperations) {
    operations.push(delayedOperation);
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

  // Finally, we reorder the pages in case the order has changed
  // Note: it's done outside page nodes since using a dedicated operation
  const pagesOrderDifferences = arrayDiff(currentTree.data.pages, newTree.data.pages);
  if (pagesOrderDifferences.length > 0) {
    console.log(`[pages order] all pages need to be reordered`);

    // Going through all since their internal index depends on others
    for (let i = 0; i < newTree.data.pages.length; i++) {
      operations.push({
        type: 'mov-page',
        id: newTree.data.pages[i],
        index: i,
      });
    }
  }

  // Make the difference between hosted thumbnails and those we think should be kept
  // TODO: we do not manage thumbnail of type `component` for now since impossible to reproduce in the UI
  const thumbnailsToDelete: string[] = [];
  for (const currentThumbnail of currentThumbnails) {
    if (!thumbnailsToKeep.has(currentThumbnail)) {
      thumbnailsToDelete.push(currentThumbnail);
    }
  }

  return {
    newDocumentName: newDocumentName,
    newTreeOperations: operations,
    newMedias: [...new Set(newMediasToUpload)], // Remove duplicates
    oldThumbnails: thumbnailsToDelete,
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

    const meta = await restoreMeta(document.figmaDocument, document.penpotDocument);

    const currentThumbnails = await postCommandGetFileObjectThumbnails({
      requestBody: {
        fileId: document.penpotDocument,
      },
    });

    let hostedDocument = await postCommandGetFile({
      requestBody: {
        id: document.penpotDocument,
      },
    });

    // Use metadata for future usage
    meta.penpotProjectId = hostedDocument.projectId as string;
    meta.penpotDocumentId = hostedDocument.id as string;
    meta.penpotLastModified = hostedDocument.modifiedAt as Date;
    meta.penpotPages = (hostedDocument.data as PenpotDocument['data']).pages;
    await saveMeta(document.figmaDocument, document.penpotDocument, meta);

    // TODO: for now the response is kebab-case despite types, so forcing the conversion (ref: https://github.com/penpot/penpot/pull/4760#pullrequestreview-2125984653)
    hostedDocument = camelCase(hostedDocument, Number.MAX_SAFE_INTEGER) as PostCommandGetFileResponse;

    const penpotDocumentFolderPath = getPenpotDocumentPath(document.figmaDocument, document.penpotDocument);
    await fs.mkdir(penpotDocumentFolderPath, { recursive: true });

    await writeBigJsonFile(getPenpotHostedDocumentTreePath(document.figmaDocument, document.penpotDocument), hostedDocument);

    const transformedDocument = await readTransformedFigmaTreeFile(document.figmaDocument, document.penpotDocument);

    const hostedCoreDocument = cleanHostedDocument(hostedDocument);
    const diff = getDifferences(document.penpotDocument, hostedCoreDocument, transformedDocument, Object.keys(currentThumbnails));

    await writeBigJsonFile(getFigmaToPenpotDiffPath(document.figmaDocument, document.penpotDocument), diff);
  }
}

export async function processOperationsChunk(
  figmaDocumentId: string,
  penpotDocumentId: string,
  differences: Differences,
  currentChunk: appCommonFilesChanges$change[],
  chunkNumber: number,
  succeededOperations: number
) {
  try {
    console.info(
      `processing the modifications chunk [${chunkNumber}] containing ${currentChunk.length} operations (previously ${succeededOperations} done over a total of ${differences.newTreeOperations.length})`
    );

    (await postCommandUpdateFile({
      requestBody: {
        id: penpotDocumentId,
        revn: 0, // Required but does no block to use a default one
        sessionId: '00000000-0000-0000-0000-000000000000', // It has to be UUID format, no matter the value for us
        changes: currentChunk,
      },
    })) as unknown; // We patched the response to avoid some processing
  } catch (error) {
    console.error(`it has failed while being processing the chunk [${chunkNumber}]`);

    if (succeededOperations > 0) {
      console.warn(`Wait a bit since we are removing processed chunks for your next retry, it will reduce the input and speed up`);

      try {
        differences.newTreeOperations.splice(0, succeededOperations - 1);

        await writeBigJsonFile(getFigmaToPenpotDiffPath(figmaDocumentId, penpotDocumentId), differences);
      } catch (error) {
        console.error(
          `it has failed removing processed chunks, please rerun the synchronization from the start to be sure the comparaison is done with the updated Penpot document`
        );

        throw error;
      }
    }

    throw error;
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

    // Consider name as already changed in case of chunk failure
    differences.newDocumentName = undefined;
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

    // Consider medias as already uploaded in case of chunk failure
    differences.newMedias = [];
  }

  if (differences.newTreeOperations.length > 0) {
    // [IMPORTANT] The Penpot scripts defines a default maximum body to 314572800 (300MB) (see `PENPOT_HTTP_SERVER_MAX_MULTIPART_BODY_SIZE`)
    // but this seems not used in their code. The limit reached at runtime is 31457280 (30MB)
    // For huge design systems the limit is easily reached since in adddition we use raw JSON and not the Penpot transit protocol that could help a bit (but would complexify the implementation since no JS Penpot mapper for now)
    // We need to chunk operations if needed
    const bodyLimitBytes = 31_457_280;

    // Removing a hardcoded amount simulating the `Differences` structure
    // It's not perfect but it would add complexity to have it exact
    const remainingBodyBytes = bodyLimitBytes - 1_000_000;

    let chunkNumber = 1;
    let currentChunkCount = 0;
    let currentChunk: appCommonFilesChanges$change[] = [];
    let succeededOperations = 0;
    for (const operation of differences.newTreeOperations) {
      const encodedOperationLength = JSON.stringify(operation).length;

      // Take into account the `,` delimiter
      if (currentChunkCount + Math.max(currentChunk.length - 1, 0) + encodedOperationLength > remainingBodyBytes) {
        // Directly process the chunk to not calculate all of them
        await processOperationsChunk(figmaDocumentId, penpotDocumentId, differences, currentChunk, chunkNumber, succeededOperations);

        currentChunk = [];
        currentChunkCount = 0;
        chunkNumber++;
        succeededOperations += currentChunk.length;
      }

      currentChunk.push(operation);
      currentChunkCount += encodedOperationLength;
    }

    // The last chunk must be processed
    if (currentChunk.length > 0) {
      await processOperationsChunk(figmaDocumentId, penpotDocumentId, differences, currentChunk, chunkNumber, succeededOperations);
    }
  }

  if (differences.oldThumbnails.length > 0) {
    console.log(`processing the removal of ${differences.oldThumbnails.length} thumbails`);

    // Note: we do not parallelize with `Promise.all()` because it could trigger rate limit
    for (const oldThumbnail of differences.oldThumbnails) {
      // TODO: uncomment when the OpenAPI schema exposes this endpoint
      // await postCommandDeleteFileObjectThumbnail({
      //   requestBody: {
      //     fileId: penpotDocumentId,
      //     objectId: oldThumbnail,
      //   },
      // });

      const response = await fetch(`${PenpotClientSettings.BASE}/command/delete-file-object-thumbnail`, {
        method: 'POST',
        body: JSON.stringify({
          fileId: penpotDocumentId,
          objectId: oldThumbnail,
        }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: (PenpotClientSettings.HEADERS as any)?.Authorization,
        },
      });

      if (response.status !== 200) {
        // If not removed there is a risk of visual defect until there is a modification inside
        // We have no easy way to retry this on the next synchronization because the tree will already be modified
        console.error(await response.json());
        console.warn(`the thumbnail ${oldThumbnail} seems to not be deleted correctly`);
      }
    }
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
    const diff = await readFigmaToPenpotDiffFile(document.figmaDocument, document.penpotDocument);

    await processDifferences(document.figmaDocument, document.penpotDocument, diff);
  }
}

export const Duration = z.string().transform((val) => {
  // We make it case insensitive because in huge files sometimes common patterns are not exact
  // Note: we rely on the duration format ISO 8601 but we expect only people to specify the time part (after "T")
  return toSeconds(parse(`PT${val.toUpperCase()}`)) * 1000; // Milliseconds
});
export type DurationType = z.infer<typeof Duration>;

export const SynchronizeOptions = z.object({
  documents: z.array(DocumentOptions),
  excludePatterns: ExcludePatterns,
  replaceFontPatterns: z.array(ReplaceFontPattern),
  hydrate: z.boolean(),
  hydrateTimeout: Duration.nullable(),
});
export type SynchronizeOptionsType = z.infer<typeof SynchronizeOptions>;

export async function synchronize(options: SynchronizeOptionsType) {
  // TODO: compute the entire node tree
  await retrieve(options);

  // TODO: then
  await transform(options);
  await compare(options);
  await set(options);

  if (!options.hydrate) {
    console.warn(
      `the document has been synchronized but some graphical enhancements can only be done from a browser. If the synchronization has pushed modifications the first user seeing the updated document may encounter those loadings for a few seconds or minutes depending on the size of the document. We advise you to perform a hydration by yourself so the first user will see the document properly directly. Either open your document into the browser, or rerun this command without "--no-hydrate", or by running the dedicated command "figpot document hydrate ..."`
    );

    return;
  }

  await hydrate({
    documents: options.documents,
    timeout: options.hydrateTimeout,
  });
}

export function formatPenpotPageUrl(baseUrl: string, projectId: string, documentId: string, pageId: string): string {
  return `${baseUrl}/#/workspace/${projectId}/${documentId}?page-id=${pageId}`;
}

export const HydrateOptions = z.object({
  documents: z.array(DocumentOptions),
  timeout: Duration.nullable(),
});
export type HydrateOptionsType = z.infer<typeof HydrateOptions>;

export async function hydrate(options: HydrateOptionsType) {
  // Get the UI access token (short-lived) (the API access token would not compatible for the following actions)
  // Note: this is inspired by `postCommandLoginWithPassword()` but we need to catch the response cookie header
  const response = await fetch(`${PenpotClientSettings.BASE}/command/login-with-password`, {
    method: 'POST',
    body: JSON.stringify({
      email: config.penpotUserEmail,
      password: config.penpotUserPassword,
    }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (response.status !== 200) {
    let details = await response.text();

    // [WORKAROUND] Mask the password if leaked by the backend
    // Ref: https://github.com/penpot/penpot/issues/4932
    details = details.replaceAll(config.penpotUserPassword, '********');

    console.error(details);

    throw new Error(`cannot generate an access token for the penpot user interface`);
  }

  const cookiesToSet = response.headers
    .getSetCookie()
    .map((cookieString) => {
      return setCookieParser.parse(cookieString);
    })
    .flat(); // Flatten because the cookie set and the library may have nested things;

  // Detect updates needed by the frontend, and wait for them to finish
  const mininumStartupTimeSeconds = 30;
  const idleIntervalAfterChangeSeconds = 10;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    // headless: false, // Can help debugging
  });

  try {
    const browserContext = await browser.newContext();
    const baseUrl = process.env.PENPOT_BASE_URL || 'https://design.penpot.app/';
    const domain = new URL(baseUrl).host;

    await browserContext.addCookies(
      cookiesToSet.map((cookie) => {
        return {
          ...cookie,
          domain: domain,
          expires: cookie.expires ? cookie.expires.getTime() / 1000 : undefined,
          sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
        };
      })
    );

    for (const document of options.documents) {
      console.log(`start hydratation for the penpot document ${document.penpotDocument}`);
      console.log(`it may take from seconds to minutes depending on the document size and if this one is synchronized for the first time`);

      const meta = await restoreMeta(document.figmaDocument, document.penpotDocument);

      // Check we have the needed information into the `meta.json`
      if (meta.penpotProjectId === 'not_known_yet') {
        throw new Error(`to run hydration you must first run the synchronization on this document on this machine`);
      }

      const page = await browserContext.newPage();

      try {
        const endpointsToWatch = ['/api/rpc/command/update-file?', '/api/rpc/command/create-file-object-thumbnail?'];
        let stage: 'start' | 'waiting-updates' = 'start';

        const pagesToWatch = [...meta.penpotPages];

        if (pagesToWatch.length === 0) {
          break;
        }

        const firstPageToWatch = pagesToWatch.shift() as string;

        await new Promise<void>((resolve, reject) => {
          // TODO: timeout should be global to all documents
          const timeoutTimerId = options.timeout
            ? setTimeout(() => {
                if (successTimerId) {
                  clearTimeout(successTimerId);
                }

                reject(new Error('hydratation has timed out before being fully complete'));
              }, options.timeout)
            : null;

          let successTimerId: ReturnType<typeof setTimeout>;

          const waitForPageChange = (timeout: number) => {
            successTimerId = setTimeout(() => {
              if (pagesToWatch.length > 0) {
                const pageToWatch = pagesToWatch.shift() as string;
                const pageUrl = formatPenpotPageUrl(baseUrl, meta.penpotProjectId, document.penpotDocument, pageToWatch);

                page
                  .evaluate((newUrl) => {
                    // We tried using `pushState` but it was not working. It seems by modifying the `href` the page is not reloaded so it fits our need
                    window.location.href = newUrl;
                  }, pageUrl)
                  .then(() => {
                    // Start again the analysis process
                    console.log(`look for change needed on the page ${pageToWatch}`);

                    waitForPageChange(idleIntervalAfterChangeSeconds * 1000);
                  })
                  .catch(reject);
              } else {
                if (timeoutTimerId) {
                  clearTimeout(timeoutTimerId);
                }

                resolve();
              }
            }, timeout);
          };

          const ongoingChanges: Request[] = [];

          page.on('request', (request) => {
            const url = request.url();
            if (stage === 'waiting-updates' && endpointsToWatch.some((endpoint) => url.includes(endpoint))) {
              console.log(`a needed request has been detected`);

              // Pause the timer until this same request triggers a respponse
              clearTimeout(successTimerId);

              ongoingChanges.push(request);
            }
          });

          page.on('response', async (response) => {
            const url = response.url();
            if (stage === 'start' && url.includes('/api/rpc/command/get-file?')) {
              if (response.status() === 200) {
                stage = 'waiting-updates';

                console.log(`look for change needed on the page ${firstPageToWatch}`);

                waitForPageChange(mininumStartupTimeSeconds * 1000);
              } else {
                reject(new Error(`document data cannot be fetched: ${await response.text()}`));
              }
            } else if (stage === 'waiting-updates' && endpointsToWatch.some((endpoint) => url.includes(endpoint))) {
              console.log(`the needed request has been performed, looking for more...`);

              // Find the corresponding request and remove it
              const requestIndex = ongoingChanges.indexOf(response.request());
              if (requestIndex !== -1) {
                ongoingChanges.splice(requestIndex, 1);

                // If no more waiting we can enable again the timer
                if (ongoingChanges.length === 0) {
                  // Note: the time is different since after the first detected change it means the rest has been loaded already
                  waitForPageChange(idleIntervalAfterChangeSeconds * 1000);
                }
              }
            }
          });

          const firstPageUrl = formatPenpotPageUrl(baseUrl, meta.penpotProjectId, document.penpotDocument, firstPageToWatch);

          page
            .goto(firstPageUrl, {
              // timeout: xxx, // It should be working by having the command timeout that will close the browser
              waitUntil: 'load',
            })
            .then((response) => {
              if (response && response.status() !== 200) {
                response
                  .text()
                  .then((value) => {
                    console.log(value);
                  })
                  .finally(() => {
                    reject(new Error(`cannot load the document page`));
                  });
              }
            });
        });

        console.log('no more update needed on the document');
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}
