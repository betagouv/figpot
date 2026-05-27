import { Separator, confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import fsSync from 'fs';
import fs from 'fs/promises';
import { glob } from 'glob';
import graphlib, { Graph } from 'graphlib';
import { mimeData } from 'human-filetypes';
import { parse, toSeconds } from 'iso8601-duration';
import arrayDiff from 'microdiff';
import ora from 'ora';
import { Request, chromium } from 'patchright';
import path from 'path';
import setCookieParser from 'set-cookie-parser';
import { parser } from 'stream-json';
import { Digraph, toDot } from 'ts-graphviz';
import { toFile } from 'ts-graphviz/adapter';
import { validate as uuidValidate, v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

import {
  Component,
  ApiError as FigmaApiError,
  GetFileNodesResponse,
  GetFileResponse,
  GetLocalVariablesResponse,
  Style,
  getImageFills,
} from '@figpot/src/clients/figma';
import {
  OpenAPI as PenpotClientSettings,
  postCreateFile,
  postGetFileObjectThumbnails,
  postGetFontVariants,
  postGetProjectFiles,
  postGetProjects,
  postGetTeams,
  postLinkFileToLibrary,
} from '@figpot/src/clients/penpot';
import { PostGetFileResponse, postGetFile, postRenameFile, postUpdateFile } from '@figpot/src/clients/penpot';
import { appCommonFilesChanges$changeWithoutUnknown } from '@figpot/src/clients/workaround';
import {
  FigmaDefinedColor,
  FigmaDefinedEffectStyle,
  FigmaDefinedTypography,
  collectTextPathRefs,
  countTotalElements,
  extractStylesEffects,
  extractStylesTypographies,
  mergeStylesColors,
  patchDocument,
  retrieveDocument,
  retrieveFigmaFileName,
  retrieveLibraryPublishedComponents,
  retrieveLibraryPublishedStyles,
  retrieveRemoteComponents,
  retrieveRemoteStyles,
  retrieveStylesNodes,
  retrieveTextPathImages,
  retrieveVariables,
} from '@figpot/src/features/figma';
import { restoreMappingFromRepository, saveMappingToRepository } from '@figpot/src/features/git';
import { cleanHostedDocument } from '@figpot/src/features/penpot';
import { transformDocumentNode } from '@figpot/src/features/transformers/transformDocumentNode';
import { FigmaVariablesData, emptyFigmaVariablesData } from '@figpot/src/features/translators/tokens/translateTokens';
import { isPageRootFrame, isPageRootFrameFromId, registerFontId, rootFrameId } from '@figpot/src/features/translators/translateId';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { Token, TokenSet, TokenTheme } from '@figpot/src/models/entities/penpot/traits/token';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';
import { formatDiffResultLog, getDiff, removeUndefinedProperties } from '@figpot/src/utils/comparaison';
import { config, figmaRateLimitContext, penpotApiBaseUrl } from '@figpot/src/utils/environment';
import { downloadFile, openAsBlob, readBigJsonFile, writeBigJsonFile } from '@figpot/src/utils/file';
import { UserCancellationExit } from '@figpot/src/utils/system';

const __root_dirname = process.cwd();

export const documentsFolderPath = path.resolve(__root_dirname, './data/documents/');
export const fontsFolderPath = path.resolve(__root_dirname, './data/fonts/');
export const mediasFolderPath = path.resolve(__root_dirname, './data/medias/');
export const textPathsFolderPath = path.resolve(__root_dirname, './data/textpaths/');

function formatSecondsHuman(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && !days && !hours) parts.push(`${seconds}s`);
  return parts.length > 0 ? parts.join(' ') : `${totalSeconds}s`;
}

export const FigmaToPenpotMapping = z.map(z.string(), z.string());
export type FigmaToPenpotMappingType = z.infer<typeof FigmaToPenpotMapping>;

export type LitePageNode = Pick<PenpotDocument['data']['pagesIndex'][0], 'id' | 'name' | 'background'> & { _apiType: 'page' };
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
export type LiteTokenSet = Pick<TokenSet, 'id' | 'name' | 'description'> & {
  _apiType: 'token-set';
};
export type LiteToken = Token & {
  _apiType: 'token';
  _setId: string; // The owning set id, needed by `set-token` operations
};
export type LiteTokenTheme = TokenTheme & {
  _apiType: 'token-theme';
};
export type NodeLabel = LitePageNode | LiteNode | LiteColor | LiteTypography | LiteComponent | LiteTokenSet | LiteToken | LiteTokenTheme;

export const Mapping = z.object({
  lastExport: z.date().nullable(),
  fonts: FigmaToPenpotMapping,
  assets: FigmaToPenpotMapping,
  nodes: FigmaToPenpotMapping,
  documents: FigmaToPenpotMapping,
  colors: FigmaToPenpotMapping,
  typographies: FigmaToPenpotMapping,
  components: FigmaToPenpotMapping,
  tokenSets: FigmaToPenpotMapping,
  tokens: FigmaToPenpotMapping,
  tokenThemes: FigmaToPenpotMapping,
});
export type MappingType = z.infer<typeof Mapping>;

export const Prompting = z.boolean().optional();
export type PromptingType = z.infer<typeof Prompting>;

export const ServerValidation = z.boolean().optional();
export type ServerValidationType = z.infer<typeof ServerValidation>;

export const Metadata = z.object({
  figmaDocumentId: z.string(),
  figmaLastModified: z.string().pipe(z.coerce.date()),
  penpotTeamId: z.string(),
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
  prompting: Prompting,
  syncMappingWithGit: z.boolean(),
  useCachedFigmaData: z.boolean(),
  libraries: z.array(DocumentOptions).default([]),
  skipLibraries: z.boolean().default(false),
});
export type RetrieveOptionsType = z.infer<typeof RetrieveOptions>;

export type ChunkGroupMetadata = {
  _groupId?: string;
  _lastOfTheGroup?: boolean;
};

export type OperationWithChunkGroupMetadata = appCommonFilesChanges$changeWithoutUnknown & ChunkGroupMetadata;

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

export function getFigmaDocumentVariablesPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'variables.json');
}

export function getFigmaDocumentEffectsPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'effects.json');
}

export function getFigmaDocumentRemoteComponentsPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'remote-components.json');
}

export function getFigmaDocumentRemoteStylesPath(documentId: string) {
  return path.resolve(getFigmaDocumentPath(documentId), 'remote-styles.json');
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

export function getFigmaTextPathSvgPath(nodeId: string, hash: string) {
  return path.resolve(textPathsFolderPath, `${nodeId.replace(/[:;]/g, '_')}_${hash}.svg`);
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

export async function readFigmaVariablesFile(documentId: string): Promise<FigmaVariablesData> {
  const figmaVariablesPath = getFigmaDocumentVariablesPath(documentId);

  if (!fsSync.existsSync(figmaVariablesPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${documentId}" before using any other command`);
  }

  const figmaVariablesString = await fs.readFile(figmaVariablesPath, 'utf-8');

  return JSON.parse(figmaVariablesString) as FigmaVariablesData;
}

export async function readFigmaEffectsFile(documentId: string): Promise<FigmaDefinedEffectStyle[]> {
  const figmaEffectsPath = getFigmaDocumentEffectsPath(documentId);

  if (!fsSync.existsSync(figmaEffectsPath)) {
    throw new Error(`make sure to run the "retrieve" command on the Figma document "${documentId}" before using any other command`);
  }

  const figmaEffectsString = await fs.readFile(figmaEffectsPath, 'utf-8');

  return JSON.parse(figmaEffectsString) as FigmaDefinedEffectStyle[];
}

export async function readFigmaRemoteComponentsFile(documentId: string): Promise<Record<string, string>> {
  const remoteComponentsPath = getFigmaDocumentRemoteComponentsPath(documentId);

  // Empty when the file has no remote components, when `--skip-libraries` was used during retrieve, or when the Figma token did not grant access to component metadata
  if (!fsSync.existsSync(remoteComponentsPath)) {
    return {};
  }

  const remoteComponentsString = await fs.readFile(remoteComponentsPath, 'utf-8');

  return JSON.parse(remoteComponentsString) as Record<string, string>;
}

export async function readFigmaRemoteStylesFile(documentId: string): Promise<Record<string, string>> {
  const remoteStylesPath = getFigmaDocumentRemoteStylesPath(documentId);

  // Empty when the file has no remote styles, when `--skip-libraries` was used during retrieve, or when the Figma token did not grant access to style metadata
  if (!fsSync.existsSync(remoteStylesPath)) {
    return {};
  }

  const remoteStylesString = await fs.readFile(remoteStylesPath, 'utf-8');

  return JSON.parse(remoteStylesString) as Record<string, string>;
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
      penpotTeamId: 'not_known_yet',
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

export async function restoreMapping(figmaDocumentId: string, penpotDocumentId: string, prompting: boolean = true): Promise<MappingType> {
  const mappingPath = getFigmaToPenpotMappingPath(figmaDocumentId, penpotDocumentId);
  let mapping: MappingType | null = null;

  if (!fsSync.existsSync(mappingPath)) {
    if (prompting) {
      // TODO: maybe add a warning if no node mapping?
      const answer = await confirm({
        message: `You target the Penpot document "${penpotDocumentId}" without having locally the mapping from previous synchronization. Are you sure to continue by overriding the target document?`,
      });

      if (!answer) {
        console.warn('the transformation operation has been aborted');

        return Promise.reject(new UserCancellationExit());
      }
    }
  } else {
    const mappingString = await fs.readFile(mappingPath, 'utf-8');
    const mappingJson = JSON.parse(mappingString);

    mapping = Mapping.parse({
      ...mappingJson,
      // Default each field to `{}` so older mapping files (saved before any of these were tracked) still parse
      fonts: new Map(Object.entries(mappingJson.fonts ?? {})),
      assets: new Map(Object.entries(mappingJson.assets ?? {})),
      nodes: new Map(Object.entries(mappingJson.nodes ?? {})),
      documents: new Map(Object.entries(mappingJson.documents ?? {})),
      colors: new Map(Object.entries(mappingJson.colors ?? {})),
      typographies: new Map(Object.entries(mappingJson.typographies ?? {})),
      components: new Map(Object.entries(mappingJson.components ?? {})),
      tokenSets: new Map(Object.entries(mappingJson.tokenSets ?? {})),
      tokens: new Map(Object.entries(mappingJson.tokens ?? {})),
      tokenThemes: new Map(Object.entries(mappingJson.tokenThemes ?? {})),
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
      tokenSets: new Map(),
      tokens: new Map(),
      tokenThemes: new Map(),
    };
  }

  if (mapping.documents.size === 0) {
    mapping.documents.set('current', penpotDocumentId);
    mapping.documents.set(figmaDocumentId, penpotDocumentId);
  }

  return mapping;
}

export async function saveMapping(figmaDocumentId: string, penpotDocumentId: string, mapping: MappingType): Promise<void> {
  await fs.mkdir(getPenpotDocumentPath(figmaDocumentId, penpotDocumentId), { recursive: true });

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
        tokenSets: Object.fromEntries(mapping.tokenSets),
        tokens: Object.fromEntries(mapping.tokens),
        tokenThemes: Object.fromEntries(mapping.tokenThemes),
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
    // When `--use-cached-figma-data` is set and every cache artifact is present on disk, skip the three Figma calls
    // (`retrieveColors` / `retrieveDocument` / `retrieveStylesNodes`) and reuse the processed outputs. `colors.json` and
    // `typographies.json` already store the final merged shape, so the intermediate `stylesNodes` response is not needed.
    // `getImageFills` below is still executed because it's a cheap call and handling it from the tree alone would add surface for bugs.
    const useCache =
      options.useCachedFigmaData &&
      fsSync.existsSync(getFigmaDocumentTreePath(document.figmaDocument)) &&
      fsSync.existsSync(getFigmaDocumentColorsPath(document.figmaDocument)) &&
      fsSync.existsSync(getFigmaDocumentTypographiesPath(document.figmaDocument));

    // Penpot library colors come only from Figma color styles whereas Figma color variables are exported as Penpot design tokens
    const figmaColors: FigmaDefinedColor[] = useCache ? await readFigmaColorsFile(document.figmaDocument) : [];

    const customPenpotFontsVariants = (await postGetFontVariants({
      requestBody: {
        fileId: document.penpotDocument,
      },
    })) as unknown as any[];

    if (options.syncMappingWithGit) {
      await restoreMappingFromRepository(document.figmaDocument, document.penpotDocument);
    }

    const mapping = await restoreMapping(document.figmaDocument, document.penpotDocument, options.prompting);

    for (const customPenpotFontVariant of customPenpotFontsVariants) {
      const simulatedFigmaFontVariantId = `${customPenpotFontVariant.fontFamily}-${customPenpotFontVariant.fontStyle}-${customPenpotFontVariant.fontWeight}`;
      const penpotFontId = customPenpotFontVariant.fontId;

      registerFontId(simulatedFigmaFontVariantId, penpotFontId, mapping);
    }

    await saveMapping(document.figmaDocument, document.penpotDocument, mapping);

    // Save the document tree locally (or reuse the last saved one to skip the expensive Figma fetch during debugging)
    let documentTree: GetFileResponse;
    if (useCache) {
      documentTree = await readFigmaTreeFile(document.figmaDocument);
    } else {
      const treeSpinner = ora(`Retrieving Figma document tree for "${document.figmaDocument}"…`).start();

      try {
        documentTree = await retrieveDocument(document.figmaDocument);

        treeSpinner.succeed(`Retrieved Figma document tree for "${document.figmaDocument}"`);
      } catch (error) {
        treeSpinner.fail(`Failed to retrieve Figma document tree for "${document.figmaDocument}"`);

        if (error instanceof FigmaApiError && error.status === 429) {
          const retryAfterHeader = figmaRateLimitContext.retryAfter;
          const rateLimitTypeHeader = figmaRateLimitContext.rateLimitType;
          const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? parseInt(retryAfterHeader, 10) : null;
          const retryHint =
            retryAfterSeconds !== null
              ? `wait ${formatSecondsHuman(retryAfterSeconds)} before retrying (the value Figma returned is ${retryAfterSeconds}s)`
              : 'wait about a minute before retrying';

          // The endpoint tier is not returned by Figma, and the public docs don't provide a machine-readable endpoint→tier map.
          // As of 2026-04, their rate-limits page cites "GET file metadata" as a Tier 2 endpoint, which is the informal name
          // for `GET /v1/files/:key` — the call we make here. Verify at https://developers.figma.com/docs/rest-api/rate-limits/
          const endpointTier = 'Tier 2';
          const seatClassHint = rateLimitTypeHeader ? ` for "${rateLimitTypeHeader}" seat class` : '';

          console.warn(
            `Figma is rate-limiting the fetch of "${document.figmaDocument}". The "get file" endpoint (${endpointTier}${seatClassHint}) is one of the most expensive and since 2026 Figma enforces stricter monthly caps on it. See https://developers.figma.com/docs/rest-api/rate-limits/ for the quota table.\nYou can either:\n` +
              `  - ${retryHint}\n` +
              `  - use a Figma account on a higher plan with a larger quota\n` +
              `  - pass "--use-cached-figma-data" to reuse the previously retrieved Figma tree, colors and typographies (if saved locally)`
          );

          throw new Error(`Figma rate limit reached on document "${document.figmaDocument}"`);
        }

        throw error;
      }
    }

    // Use metadata for future usage
    const meta = await restoreMeta(document.figmaDocument, document.penpotDocument);
    meta.figmaDocumentId = documentTree.mainFileKey || document.figmaDocument;
    meta.figmaLastModified = new Date(documentTree.lastModified);
    await saveMeta(document.figmaDocument, document.penpotDocument, meta);

    // Process attached styles (skipped when using the cached data — `typographies.json` is already the final output and is re-read later by `transform()`)
    if (!useCache) {
      const stylesIds: string[] = Object.keys(documentTree.styles);

      // The Figma API does not expose styles easily, so we have to use an endpoint to get simulated applied styles to extract wanted values
      // Ref: https://forum.figma.com/t/rest-api-get-color-and-text-styles/49216/4
      let stylesNodes: GetFileNodesResponse['nodes'];
      let figmaVariables: GetLocalVariablesResponse['meta'];

      const stylesSpinner = ora(`Retrieving Figma styles and variables for "${document.figmaDocument}"…`).start();

      try {
        stylesNodes = await retrieveStylesNodes(document.figmaDocument, stylesIds);
        figmaVariables = await retrieveVariables(document.figmaDocument);

        stylesSpinner.succeed(`Retrieved Figma styles and variables for "${document.figmaDocument}"`);
      } catch (error) {
        stylesSpinner.fail(`Failed to retrieve Figma styles and variables for "${document.figmaDocument}"`);

        throw error;
      }

      const figmaTypographies = extractStylesTypographies(documentTree, stylesNodes);
      const figmaEffects = extractStylesEffects(documentTree, stylesNodes);
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
      await fs.writeFile(getFigmaDocumentEffectsPath(document.figmaDocument), JSON.stringify(figmaEffects, null, 2), {
        encoding: 'utf-8',
      });
      await fs.writeFile(getFigmaDocumentVariablesPath(document.figmaDocument), JSON.stringify(figmaVariables, null, 2), {
        encoding: 'utf-8',
      });
    }

    // Save images
    const imagesList = await getImageFills({
      fileKey: document.figmaDocument,
    });

    await fs.mkdir(mediasFolderPath, { recursive: true });

    for (const [figmaImageId, temporaryFileUrl] of Object.entries(imagesList.meta.images)) {
      const filePath = getFigmaMediaPath(figmaImageId);

      // It should always be the same extension so simplifying with the wildcard pattern
      // (the extension is retrieved from HTTP headers when downloading)
      // `windowsPathsNoEscape` so backslashes from `path.resolve()` on Windows are treated as separators, not as the escape character
      const potentielExistingFilesPaths = await glob(`${filePath}.*`, { windowsPathsNoEscape: true });

      // We assume uploaded images are immutable, so if locally existing, skip
      if (potentielExistingFilesPaths.length === 0) {
        console.log(`downloading the image ${figmaImageId} from Figma`);

        await downloadFile(temporaryFileUrl, filePath);
      }
    }

    // Figma "text on a path" (TEXT_PATH) has no Penpot equivalent. We fetch each one rendered by Figma as
    // an SVG (glyphs outlined) and cache it on disk under a content-hashed filename so a later edit
    // of the text-path triggers a re-fetch (Figma's API has no per-node `modifiedAt`, hashing is
    // the only way to invalidate the cache). This is the only async place for it
    const textPathRefs = collectTextPathRefs(documentTree);
    const textPathRefsToFetch = textPathRefs.filter((ref) => !fsSync.existsSync(getFigmaTextPathSvgPath(ref.nodeId, ref.hash)));

    if (textPathRefsToFetch.length > 0) {
      await fs.mkdir(textPathsFolderPath, { recursive: true });

      const textPathImages = await retrieveTextPathImages(
        document.figmaDocument,
        textPathRefsToFetch.map((ref) => ref.nodeId)
      );

      for (const ref of textPathRefsToFetch) {
        const svgUrl = textPathImages[ref.nodeId];
        if (!svgUrl) {
          throw new Error(`Figma did not return an SVG render for the text-path node "${ref.nodeId}"`);
        }

        console.log(`downloading the text-path SVG ${ref.nodeId} from Figma`);

        const svgResponse = await fetch(svgUrl);

        await fs.writeFile(getFigmaTextPathSvgPath(ref.nodeId, ref.hash), await svgResponse.text(), { encoding: 'utf-8' });
      }
    }

    // Note: old `<nodeId>_<oldHash>.svg` files accumulate on disk when a text-path's content
    // changes. We do not auto-clean because `textPathsFolderPath` is shared across documents and
    // a per-document cleanup pass would need extra bookkeeping. Wipe the folder manually if its
    // size becomes an issue — the next sync will re-fetch whatever is still in use
  }

  // Cross-file binding resolution run after trees fetching to be sure having all libraries information needed
  if (options.skipLibraries) {
    for (const document of options.documents) {
      await fs.writeFile(getFigmaDocumentRemoteComponentsPath(document.figmaDocument), '{}', { encoding: 'utf-8' });
      await fs.writeFile(getFigmaDocumentRemoteStylesPath(document.figmaDocument), '{}', { encoding: 'utf-8' });
    }
  } else {
    const crossFileSpinner = ora('Resolving cross-file component and style bindings…').start();

    try {
      // A component or style that is `remote: false` in document X means X is the publisher of that
      // key. So walking every co-synced doc's local components+styles gives us a free
      // `key -> publisher` index for anything published by another doc in this same sync command
      const figmaComponentsByDocument = new Map<string, Record<string, Component>>();
      const figmaStylesByDocument = new Map<string, Record<string, Style>>();
      const publishersByComponentKey = new Map<string, string>();
      const publishersByStyleKey = new Map<string, string>();

      crossFileSpinner.text = `Resolving cross-file bindings: scanning ${options.documents.length} co-synced document(s)…`;

      for (const document of options.documents) {
        const tree = await readFigmaTreeFile(document.figmaDocument);
        figmaComponentsByDocument.set(document.figmaDocument, tree.components);
        figmaStylesByDocument.set(document.figmaDocument, tree.styles);

        for (const component of Object.values(tree.components)) {
          if (component.remote !== true) {
            publishersByComponentKey.set(component.key, document.figmaDocument);
          }
        }
        for (const style of Object.values(tree.styles)) {
          if (style.remote !== true) {
            publishersByStyleKey.set(style.key, document.figmaDocument);
          }
        }
      }

      // [OPTIMIZATION] Retrieve each library's published components and styles list
      if (options.libraries.length > 0) {
        crossFileSpinner.text = `Resolving cross-file bindings: listing published components and styles for ${options.libraries.length} declared library(ies)…`;

        for (const lib of options.libraries) {
          const publishedComponents = await retrieveLibraryPublishedComponents(lib.figmaDocument);
          for (const published of publishedComponents) {
            publishersByComponentKey.set(published.key, published.file_key);
          }

          const publishedStyles = await retrieveLibraryPublishedStyles(lib.figmaDocument);
          for (const published of publishedStyles) {
            publishersByStyleKey.set(published.key, published.file_key);
          }
        }
      }

      crossFileSpinner.text = 'Resolving cross-file bindings: resolving remaining unknown publishers…';

      for (const document of options.documents) {
        const figmaComponents = figmaComponentsByDocument.get(document.figmaDocument)!;
        const figmaStyles = figmaStylesByDocument.get(document.figmaDocument)!;

        const remoteComponentSourceFiles = await retrieveRemoteComponents(figmaComponents, publishersByComponentKey);
        await fs.writeFile(getFigmaDocumentRemoteComponentsPath(document.figmaDocument), JSON.stringify(remoteComponentSourceFiles, null, 2), {
          encoding: 'utf-8',
        });

        const remoteStyleSourceFiles = await retrieveRemoteStyles(figmaStyles, publishersByStyleKey);
        await fs.writeFile(getFigmaDocumentRemoteStylesPath(document.figmaDocument), JSON.stringify(remoteStyleSourceFiles, null, 2), {
          encoding: 'utf-8',
        });
      }

      crossFileSpinner.succeed('Resolved cross-file component and style bindings');
    } catch (error) {
      crossFileSpinner.fail('Failed to resolve cross-file component and style bindings');

      throw error;
    }
  }
}

export function transformDocument(
  documentTree: GetFileResponse,
  colors: FigmaDefinedColor[],
  typographies: FigmaDefinedTypography[],
  variables: FigmaVariablesData,
  effectStyles: FigmaDefinedEffectStyle[],
  libraryFiles: Map<string, string>,
  remoteComponentSourceFiles: Map<string, string>,
  remoteStyleSourceFiles: Map<string, string>,
  mapping: MappingType
) {
  // Go from the Figma format to the Penpot one
  const penpotTree = transformDocumentNode(
    documentTree,
    colors,
    typographies,
    variables,
    effectStyles,
    libraryFiles,
    remoteComponentSourceFiles,
    remoteStyleSourceFiles,
    mapping
  );

  // We have to patch the document since `{}` is not equal to `{ a: undefined }`,
  // and since we do comparaisons both in later stage or when doing tests we need to make sure
  // all properties set to `undefined` by `transformDocumentNode()` won't "produce" an object difference
  removeUndefinedProperties(penpotTree);

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
  setWeight: z.number().int().positive().optional(),
  setStyle: z.enum(['normal', 'italic']).optional(),
});
export type ReplaceFontPatternType = z.infer<typeof ReplaceFontPattern>;

export const TransformOptions = z.object({
  documents: z.array(DocumentOptions),
  excludePatterns: ExcludePatterns,
  replaceFontPatterns: z.array(ReplaceFontPattern),
  syncMappingWithGit: z.boolean(),
  prompting: Prompting,
  libraries: z.array(DocumentOptions).default([]),
});
export type TransformOptionsType = z.infer<typeof TransformOptions>;

export async function transform(options: TransformOptionsType) {
  const libraryFiles = new Map<string, string>();

  for (const lib of options.libraries) {
    libraryFiles.set(lib.figmaDocument, lib.penpotDocument);
  }

  // Documents synchronized may also be considered as "libraries" if any link with the other documents
  for (const doc of options.documents) {
    libraryFiles.set(doc.figmaDocument, doc.penpotDocument);
  }

  // Go from the Figma format to the Penpot one
  // Note: order of processing the dependencies tree is irrelevant because published entities have a stable UUIDs
  // and the associated `fileId` with them would be patched in any case
  for (const document of options.documents) {
    const figmaTree = await readFigmaTreeFile(document.figmaDocument);
    const figmaColors = await readFigmaColorsFile(document.figmaDocument);
    const figmaTypographies = await readFigmaTypographiesFile(document.figmaDocument);
    const figmaVariables = await readFigmaVariablesFile(document.figmaDocument);
    const figmaEffectStyles = await readFigmaEffectsFile(document.figmaDocument);
    const figmaRemoteComponents = await readFigmaRemoteComponentsFile(document.figmaDocument);
    const figmaRemoteStyles = await readFigmaRemoteStylesFile(document.figmaDocument);

    const remoteComponentSourceFiles = new Map(Object.entries(figmaRemoteComponents));
    const remoteStyleSourceFiles = new Map(Object.entries(figmaRemoteStyles));

    patchDocument(figmaTree, figmaColors, figmaTypographies, options.excludePatterns, options.replaceFontPatterns);

    const elementsCount = countTotalElements(figmaTree, figmaColors, figmaTypographies);

    console.log(`the figma document contains around ${elementsCount} elements`);

    const advisedElementsLimit = 150_000;
    if (elementsCount > advisedElementsLimit) {
      if (options.prompting) {
        const answer = await confirm({
          message: `The Figma document tree you want to synchronize is really huge. Over ${advisedElementsLimit} elements we are quick sure both the Penpot backend and the frontend won't be able to render your document until Penpot evolves. Have a look at our documentation to see how to exclude nodes that bring to you no value and that could make the document loadable. Do you want to by-pass this warning and continue processing an unloadable file?`,
        });

        if (!answer) {
          console.warn('the transformation operation has been aborted');

          return Promise.reject(new UserCancellationExit());
        }
      } else {
        console.warn(
          `the Figma document tree you want to synchronize is really huge. Over ${advisedElementsLimit} elements we are quick sure both the Penpot backend and the frontend won't be able to render your document until Penpot evolves. Have a look at our documentation to see how to exclude nodes that bring to you no value and that could make the document loadable`
        );
      }
    }

    const mapping = await restoreMapping(document.figmaDocument, document.penpotDocument, options.prompting);

    const penpotTree = transformDocument(
      figmaTree,
      figmaColors,
      figmaTypographies,
      figmaVariables,
      figmaEffectStyles,
      libraryFiles,
      remoteComponentSourceFiles,
      remoteStyleSourceFiles,
      mapping
    );

    // Save mapping for later usage
    await saveMapping(document.figmaDocument, document.penpotDocument, mapping);

    // Try to push to Git directly in case updating Penpot would fail, like that if elements have been partially pushed to Penpot
    // they can be kept since having the same IDs on the next retry... helpful in case the failure was due to the amount of modifications :)
    if (options.syncMappingWithGit) {
      await saveMappingToRepository(document.figmaDocument, document.penpotDocument);
    }

    await writeBigJsonFile(getTransformedFigmaTreePath(document.figmaDocument, document.penpotDocument), penpotTree);
  }
}

export interface Differences {
  newDocumentName?: string;
  newTreeOperations: OperationWithChunkGroupMetadata[];
  newMedias: string[];
  oldThumbnails: string[];
}

export function pushOperationsWithOrderingLogic(
  normalOperations: appCommonFilesChanges$changeWithoutUnknown[],
  delayedOperations: appCommonFilesChanges$changeWithoutUnknown[],
  delayedForChildrenOperations: appCommonFilesChanges$changeWithoutUnknown[],
  operationToAddress: appCommonFilesChanges$changeWithoutUnknown
) {
  if (operationToAddress.type === 'mod-obj') {
    // A shapes modification may fail with `referential-integrity` error, it needs to be performed once the children are set up
    // We have to deduplicate the logic by extracting this
    const suboperationToMutate = operationToAddress.operations.findIndex((suboperation) => {
      return suboperation.type === 'assign' && Array.isArray(suboperation.value.shapes) && (suboperation.value.shapes as string[]).length > 0;
    });

    if (suboperationToMutate !== -1) {
      const suboperationObject = operationToAddress.operations[suboperationToMutate];

      assert(suboperationObject.type === 'assign');

      delayedForChildrenOperations.push({
        type: operationToAddress.type,
        id: operationToAddress.id,
        pageId: operationToAddress.pageId,
        operations: [
          {
            type: 'assign',
            value: {
              shapes: suboperationObject.value.shapes,
            },
          },
        ],
      });

      // Remove this from the current operation, or the current operation if only shapes were modified
      if (Object.keys(suboperationObject.value).length > 1) {
        delete suboperationObject.value.shapes;
      } else {
        operationToAddress.operations.splice(suboperationToMutate, 1);
      }
    }

    // If no more operation for the original one we can skip it because if `pageId` has changed it would be handled by the second one
    if (operationToAddress.operations.length > 0) {
      normalOperations.push(operationToAddress);
    }
  } else if (operationToAddress.type === 'add-obj') {
    if ('shapes' in operationToAddress.obj && operationToAddress.obj.shapes && operationToAddress.obj.shapes.length > 0) {
      delayedForChildrenOperations.push({
        type: 'mod-obj',
        id: operationToAddress.id,
        pageId: operationToAddress.pageId,
        operations: [
          {
            type: 'assign',
            value: {
              shapes: operationToAddress.obj.shapes,
            },
          },
        ],
      });

      operationToAddress.obj.shapes = []; // Set the initial one since required
    }

    normalOperations.push(operationToAddress);
  } else {
    normalOperations.push(operationToAddress);
  }
}

export function delayBindingOperation(
  delayedOperations: appCommonFilesChanges$changeWithoutUnknown[],
  nodeId: string,
  pageId?: string,
  componentId?: string,
  componentFile?: string,
  componentRoot?: boolean,
  mainInstance?: boolean,
  isVariantContainer?: boolean,
  variantId?: string,
  variantName?: string,
  shapeRef?: string
) {
  // Sometimes the API requires the targeted node by `shapeRef` to be created before (sometimes not)
  // So we decided to delay all bindings to be sure locally all main component instances exist
  // Note: maybe it happens since we chunk operations for large documents
  // Note: we have to delay all component stuff otherwise the API invalidates the input

  // Since types are dynamic based on "type" property we cannot easily manipulate them once assigned elsewhere, so reusing the value type that is not totally defined
  const delayedAssignValues: { [key: string]: unknown } = {};

  // A main instance has no `shapeRef`, and the API refuses it if `null/undefined` so using conditions to avoid triggering a backend calculation
  if (componentId !== undefined) {
    delayedAssignValues.componentId = componentId;
  }
  if (componentFile !== undefined) {
    delayedAssignValues.componentFile = componentFile;
  }
  if (componentRoot !== undefined) {
    delayedAssignValues.componentRoot = componentRoot;
  }
  if (mainInstance !== undefined) {
    delayedAssignValues.mainInstance = mainInstance;
  }
  if (isVariantContainer !== undefined) {
    delayedAssignValues.isVariantContainer = isVariantContainer;
  }
  if (variantId !== undefined) {
    delayedAssignValues.variantId = variantId;
  }
  if (variantName !== undefined) {
    delayedAssignValues.variantName = variantName;
  }
  if (shapeRef !== undefined) {
    delayedAssignValues.shapeRef = shapeRef;
  }

  delayedOperations.push({
    type: 'mod-obj',
    id: nodeId,
    pageId: pageId,
    operations: [{ type: 'assign', value: delayedAssignValues }],
  });
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
  normalOperations: appCommonFilesChanges$changeWithoutUnknown[],
  delayedOperations: appCommonFilesChanges$changeWithoutUnknown[],
  delayedForChildrenOperations: appCommonFilesChanges$changeWithoutUnknown[],
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
    isVariantContainer,
    variantId,
    variantName,
    shapeRef,
    ...propertiesObj
  } = itemAfter; // Instruction to omit some properties

  assert(itemAfter.parentId);
  assert(itemAfter.frameId);

  const objId = itemAfter.id; // Penpot allows forcing the ID at creation
  const objPageId = itemAfter._realPageParentId || _pageId;
  const objFrameId = isPageRootFrameFromId(itemAfter.frameId) ? rootFrameId : itemAfter.frameId;
  const objParentId = isPageRootFrameFromId(itemAfter.parentId) ? rootFrameId : itemAfter.parentId;

  const operation: appCommonFilesChanges$changeWithoutUnknown = {
    type: 'add-obj',
    id: objId,
    pageId: objPageId,
    frameId: objFrameId,
    parentId: objParentId,
    obj: {
      ...propertiesObj,
      ...({
        oldId: previousNodeIdBeforeMove, // Can be used by the Penpot internals, specific to operations when an object is moved across pages (with cut/paste)
      } as any), // TODO: it was used before API types update, not sure it should be removed now
      // For whatever reason the new API requires setting again the following already specified above
      id: objId,
      frameId: objFrameId,
      parentId: objParentId,
    },
  };

  pushOperationsWithOrderingLogic(normalOperations, delayedOperations, delayedForChildrenOperations, operation);

  if (
    componentId ||
    componentFile ||
    componentRoot !== undefined ||
    mainInstance !== undefined ||
    isVariantContainer !== undefined ||
    variantId ||
    variantName ||
    shapeRef
  ) {
    delayBindingOperation(
      delayedOperations,
      id,
      _pageId,
      componentId,
      componentFile,
      componentRoot,
      mainInstance,
      isVariantContainer,
      variantId,
      variantName,
      shapeRef
    );
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
      background: currentPageNode.background,
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

  if (currentTree.data.tokenSets) {
    for (const currentSet of Object.values(currentTree.data.tokenSets)) {
      assert(currentSet.id);

      flattenCurrentGlobalTree.set(currentSet.id, {
        _apiType: 'token-set',
        id: currentSet.id,
        name: currentSet.name,
        description: currentSet.description,
      });

      for (const currentToken of Object.values(currentSet.tokens)) {
        assert(currentToken.id);

        flattenCurrentGlobalTree.set(currentToken.id, {
          _apiType: 'token',
          _setId: currentSet.id,
          ...currentToken,
        });
      }
    }
  }

  if (currentTree.data.tokenThemes) {
    for (const currentTheme of Object.values(currentTree.data.tokenThemes)) {
      assert(currentTheme.id);

      flattenCurrentGlobalTree.set(currentTheme.id, {
        _apiType: 'token-theme',
        ...currentTheme,
      });
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
      background: newPageNode.background,
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

  if (newTree.data.tokenSets) {
    for (const newSet of Object.values(newTree.data.tokenSets)) {
      assert(newSet.id);

      flattenNewGlobalTree.set(newSet.id, {
        _apiType: 'token-set',
        id: newSet.id,
        name: newSet.name,
        description: newSet.description,
      });

      for (const newToken of Object.values(newSet.tokens)) {
        assert(newToken.id);

        flattenNewGlobalTree.set(newToken.id, {
          _apiType: 'token',
          _setId: newSet.id,
          ...newToken,
        });
      }
    }
  }

  if (newTree.data.tokenThemes) {
    for (const newTheme of Object.values(newTree.data.tokenThemes)) {
      assert(newTheme.id);

      flattenNewGlobalTree.set(newTheme.id, {
        _apiType: 'token-theme',
        ...newTheme,
      });
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

  const afterVariantsIds: string[] = [];

  if (newTree.data.components) {
    for (const newComponent of Object.values(newTree.data.components)) {
      assert(newComponent.id);

      if (newComponent.variantId) {
        afterVariantsIds.push(newComponent.variantId);
      }

      flattenNewGlobalTree.set(newComponent.id, {
        _apiType: 'component',
        ...newComponent,
      } as LiteComponent);
    }
  }

  const diffResult = getDiff(flattenCurrentGlobalTree, flattenNewGlobalTree);

  console.log(`[nodes differences] ${formatDiffResultLog(diffResult)}`);

  const operations: OperationWithChunkGroupMetadata[] = [];
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
      } else if (item.after._apiType === 'token-set') {
        operations.push({
          type: 'set-token-set',
          id: item.after.id,
          attrs: { id: item.after.id, name: item.after.name, description: item.after.description ?? '' },
        });
      } else if (item.after._apiType === 'token') {
        // `set-token` carries the token name as an attribute (the JSON endpoint keywordizes object keys,
        // so emitting tokens inline in `set-token-set.attrs.tokens` would fail validation)
        operations.push({
          type: 'set-token',
          setId: item.after._setId,
          tokenId: item.after.id,
          attrs: {
            id: item.after.id,
            name: item.after.name,
            // The Penpot JSON decoder converts camelCase strings (e.g. `borderRadius`) to its
            // kebab Clojure keyword (`:border-radius`); sending the kebab string is rejected. Our
            // openapi-generated union types are kebab-case, so cast here to bypass the TS literal
            // check while keeping the value the API actually accepts
            type: item.after.type as never,
            value: item.after.value,
            description: item.after.description ?? '',
          },
        });
      } else if (item.after._apiType === 'token-theme') {
        operations.push({
          type: 'set-token-theme',
          id: item.after.id,
          attrs: {
            id: item.after.id,
            name: item.after.name,
            group: item.after.group,
            description: item.after.description ?? '',
            isSource: item.after.isSource ?? false,
            sets: item.after.sets,
          },
        });
      } else if (item.after._apiType === 'typography') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-typography',
          typography: {
            ...propertiesObj,
          },
        });
      } else if (item.after._apiType === 'component') {
        const { _apiType, variantId, variantProperties, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-component',
          ...propertiesObj,
        });

        // `component` changes have priority over all `obj` changes
        // but for variants the node has to exist before binding it, so we delay this binding
        if (variantId || variantProperties) {
          delayedOperations.push({
            type: 'mod-component',
            id: propertiesObj.id,
            variantId: variantId,
            variantProperties: variantProperties,
          });
        }
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
      } else if (item.after._apiType === 'token-set') {
        operations.push({
          type: 'set-token-set',
          id: item.after.id,
          attrs: { id: item.after.id, name: item.after.name, description: item.after.description ?? '' },
        });
      } else if (item.after._apiType === 'token') {
        operations.push({
          type: 'set-token',
          setId: item.after._setId,
          tokenId: item.after.id,
          attrs: {
            id: item.after.id,
            name: item.after.name,
            // The Penpot JSON decoder converts camelCase strings (e.g. `borderRadius`) to its
            // kebab Clojure keyword (`:border-radius`); sending the kebab string is rejected. Our
            // openapi-generated union types are kebab-case, so cast here to bypass the TS literal
            // check while keeping the value the API actually accepts
            type: item.after.type as never,
            value: item.after.value,
            description: item.after.description ?? '',
          },
        });
      } else if (item.after._apiType === 'token-theme') {
        operations.push({
          type: 'set-token-theme',
          id: item.after.id,
          attrs: {
            id: item.after.id,
            name: item.after.name,
            group: item.after.group,
            description: item.after.description ?? '',
            isSource: item.after.isSource ?? false,
            sets: item.after.sets,
          },
        });
      } else if (item.after._apiType === 'typography') {
        const { _apiType, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'mod-typography',
          typography: {
            ...propertiesObj,
          },
        });
      } else if (item.after._apiType === 'component') {
        const { _apiType, variantId, variantProperties, ...propertiesObj } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'mod-component',
          ...propertiesObj,
        });

        // As for the `add-component` change we have to delay the bindings since variant node has to exist first
        if (variantId || variantProperties) {
          delayedOperations.push({
            type: 'mod-component',
            id: propertiesObj.id,
            variantId: variantId,
            variantProperties: variantProperties,
          });
        }
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

      if (node && node._apiType === 'node' && node.type === 'frame' && !isPageRootFrameFromId(node.id)) {
        foundTopBranchFrame = true;
        topBranchFrame = node;
      }
    }

    const nodeOperationsAfterChildrenAreProcessed: appCommonFilesChanges$changeWithoutUnknown[] = [];

    if (item.state === 'added') {
      assert(item.after.id);

      if (item.after._apiType === 'page') {
        const { _apiType, id, name, background } = item.after; // Instruction to omit some properties

        operations.push({
          type: 'add-page',
          id: id, // Penpot allows forcing the ID at creation
          name: name,
        });

        // The background cannot be set at creation
        if (background) {
          operations.push({
            type: 'mod-page',
            id: id,
            background: background,
          });
        }
      } else if (item.after._apiType === 'node') {
        if (isPageRootFrame(item.after)) {
          const { _apiType, _realPageParentId, _pageId, frameId, id, parentId, ...propertiesObj } = item.after; // Instruction to omit some properties

          // The root frame is automatically created with its wrapping page (the iteration before this one normally), so we just need to apply modifications if needed
          // Note: root frame can only have its colors customized
          const operation: appCommonFilesChanges$changeWithoutUnknown = {
            type: 'mod-obj',
            id: rootFrameId,
            pageId: _pageId,
            operations: [
              {
                type: 'assign',
                value: {
                  fills: propertiesObj.fills,
                },
              },
            ],
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
          background: item.after.background,
        });
      } else if (item.after._apiType === 'node') {
        const {
          _apiType,
          _realPageParentId,
          _pageId,
          id,
          componentId,
          componentFile,
          componentRoot,
          mainInstance,
          isVariantContainer,
          variantId,
          variantName,
          shapeRef,
          ...propertiesObj
        } = item.after; // Instruction to omit some properties

        assert(id);

        // Penpot cannot move an object across pages, nor morph a shape `type` in place (e.g. circle -> path)
        // In both cases we combine a deletion and a re-creation instead of a modification
        // Note: only objects can be moved, not the root frame so not handlind this complex logic
        if (item.before._apiType === 'node' && (item.before._pageId !== item.after._pageId || item.before.type !== item.after.type)) {
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

          const operation: appCommonFilesChanges$changeWithoutUnknown = {
            type: 'mod-obj',
            id: isPageRootFrameFromId(id) ? rootFrameId : id,
            pageId: _pageId,
            operations: [
              {
                type: 'assign',
                value: Object.fromEntries(
                  uniqueProperties.map((property) => {
                    return [
                      property,
                      (property === 'parentId' || property === 'frameId') && isPageRootFrameFromId(propertiesObj[property] as string)
                        ? rootFrameId
                        : propertiesObj[property],
                    ];
                  })
                ),
              },
            ],
          };

          pushOperationsWithOrderingLogic(operations, delayedOperations, nodeOperationsAfterChildrenAreProcessed, operation);

          if (
            item.before._apiType === 'node' &&
            (item.before.componentId !== item.after.componentId ||
              item.before.componentFile !== item.after.componentFile ||
              item.before.componentRoot !== item.after.componentRoot ||
              item.before.mainInstance !== item.after.mainInstance ||
              item.before.isVariantContainer !== item.after.isVariantContainer ||
              item.before.variantId !== item.after.variantId ||
              item.before.variantName !== item.after.variantName ||
              item.before.shapeRef !== item.after.shapeRef)
          ) {
            delayBindingOperation(
              delayedOperations,
              id,
              _pageId,
              componentId,
              componentFile,
              componentRoot,
              mainInstance,
              isVariantContainer,
              variantId,
              variantName,
              shapeRef
            );
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
  //
  // [IMPORTANT] Due to the Penpot variant validation on the entire tree, it requires some metadata to be set at the same time
  // to have a valid tree. After manually testing what had to be grouped the strategy has been defined as:
  // 1. List of variants IDS
  // 2. Group by variant ID mandatory changes
  //    * `mod-obj` with `variantId` being the variant ID (it's when we set `variantId` and `variantName`)
  //    * `mod-obj` with `id` being the variant ID (it's when we set `isVariantContainer` on the variant wrapper (component set))
  //    * `mod-component` with `variantId` being the variant ID (it's when we set `variantId` and `variantProperties` on the component definition)
  // 3. A group cannot be splitted on more than a chunk
  const variantOperations = new Map<string, typeof operations>();

  for (const delayedOperation of delayedOperations) {
    let foundVariantId: string | null = null;

    // We browse this loop just once to at first separate what does not matter and what is
    if (delayedOperation.type === 'mod-obj') {
      const assignOperation = delayedOperation.operations.find((operation) => operation.type === 'assign');

      if (assignOperation) {
        assert(assignOperation.type === 'assign');

        if (assignOperation.value.variantId && afterVariantsIds.includes(assignOperation.value.variantId as string)) {
          foundVariantId = assignOperation.value.variantId as string;
        } else if (delayedOperation.id && afterVariantsIds.includes(delayedOperation.id as string)) {
          foundVariantId = delayedOperation.id as string;
        }
      }
    } else if (
      delayedOperation.type === 'mod-component' &&
      (delayedOperation.variantId || delayedOperation.variantProperties) && // It should be safe since `variantProperties` won't be set without `variantId`
      afterVariantsIds.includes(delayedOperation.variantId as string)
    ) {
      foundVariantId = delayedOperation.variantId as string;
    }

    if (foundVariantId) {
      const registeredVariantOperations = variantOperations.get(foundVariantId);

      if (!registeredVariantOperations) {
        variantOperations.set(foundVariantId, [delayedOperation]);
      } else {
        registeredVariantOperations.push(delayedOperation);
      }
    } else {
      operations.push(delayedOperation);
    }
  }

  // Those grouped operations must be marked so the chunk logic knows when it's allowed to start a new chunk
  for (const [variantId, currentVariantOperations] of variantOperations) {
    for (const [operationIndex, operation] of currentVariantOperations.entries()) {
      operations.push({
        ...operation,
        _groupId: variantId,
        _lastOfTheGroup: operationIndex === currentVariantOperations.length - 1,
      });
    }
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
      } else if (item.before._apiType === 'token-set') {
        // Penpot's DTCG export strips the real internal set id, so the deterministic uuidv5 we
        // re-derive in `cleanHostedDocument` doesn't match any set that has been created from the UI.
        // The user has to remove them manually (we cannot warn him since the server fails silently)
        operations.push({ type: 'set-token-set', id: item.before.id, attrs: null });
      } else if (item.before._apiType === 'token') {
        operations.push({ type: 'set-token', setId: item.before._setId, tokenId: item.before.id, attrs: null });
      } else if (item.before._apiType === 'token-theme') {
        operations.push({ type: 'set-token-theme', id: item.before.id, attrs: null });
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

  // Also adjust the active token themes
  const currentActiveThemes = currentTree.data.activeTokenThemes ?? [];
  const newActiveThemes = newTree.data.activeTokenThemes ?? [];
  const activeThemesChanged =
    currentActiveThemes.length !== newActiveThemes.length || currentActiveThemes.some((themePath, index) => themePath !== newActiveThemes[index]);
  if (activeThemesChanged) {
    operations.push({ type: 'set-active-token-themes', themePaths: newActiveThemes });
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

    let currentThumbnails: Awaited<ReturnType<typeof postGetFileObjectThumbnails>>;
    let hostedDocument: Awaited<ReturnType<typeof postGetFile>>;

    const penpotFetchSpinner = ora(`Fetching current state of Penpot file "${document.penpotDocument}"…`).start();

    try {
      currentThumbnails = await postGetFileObjectThumbnails({
        requestBody: {
          fileId: document.penpotDocument,
        },
      });

      hostedDocument = await postGetFile({
        requestBody: {
          id: document.penpotDocument,
        },
      });

      penpotFetchSpinner.succeed(`Fetched current state of Penpot file "${document.penpotDocument}"`);
    } catch (error) {
      penpotFetchSpinner.fail(`Failed to fetch current state of Penpot file "${document.penpotDocument}"`);

      throw error;
    }

    const penpotDocumentFolderPath = getPenpotDocumentPath(document.figmaDocument, document.penpotDocument);
    await fs.mkdir(penpotDocumentFolderPath, { recursive: true });

    await writeBigJsonFile(getPenpotHostedDocumentTreePath(document.figmaDocument, document.penpotDocument), hostedDocument);

    const transformedDocument = await readTransformedFigmaTreeFile(document.figmaDocument, document.penpotDocument);

    const hostedCoreDocument = cleanHostedDocument(hostedDocument);
    const diff = getDifferences(document.penpotDocument, hostedCoreDocument, transformedDocument, Object.keys(currentThumbnails));

    await writeBigJsonFile(getFigmaToPenpotDiffPath(document.figmaDocument, document.penpotDocument), diff);

    // Use metadata for future usage
    // Note: `lastModified` and `pages` may have not much value since they are retrieved because the modifications are pushed
    // [WORKAROUND] We use transformed pages to fill the value so hydratation is based on pages after updates (otherwise it would work only after 2 stable synchronizations, which has no sense)
    meta.penpotTeamId = (hostedDocument as any).teamId;
    meta.penpotProjectId = hostedDocument.projectId;
    meta.penpotDocumentId = hostedDocument.id;
    meta.penpotLastModified = new Date(hostedDocument.modifiedAt);
    meta.penpotPages = transformedDocument.data.pages;
    await saveMeta(document.figmaDocument, document.penpotDocument, meta);
  }
}

export async function processOperationsChunk(
  penpotDocumentId: string,
  currentChunk: appCommonFilesChanges$changeWithoutUnknown[],
  serverValidation: boolean = true
) {
  await postUpdateFile({
    requestBody: {
      id: penpotDocumentId,
      revn: 0, // Required but does no block to use a default one
      vern: 0, // Don't know what is it yet but it's required
      sessionId: '00000000-0000-0000-0000-000000000000', // It has to be UUID format, no matter the value for us
      changes: currentChunk,
      skipValidate: !serverValidation,
    },
  });
}

export async function processDifferences(
  figmaDocumentId: string,
  penpotDocumentId: string,
  differences: Differences,
  serverValidation: boolean = true,
  prompting: boolean = true
) {
  // Note: seeing the name change in the UI requires a browser page refresh
  if (differences.newDocumentName) {
    await postRenameFile({
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
    const mapping = await restoreMapping(figmaDocumentId, penpotDocumentId, prompting);

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
      // `windowsPathsNoEscape` so backslashes from `path.resolve()` on Windows are treated as separators, not as the escape character
      const potentielExistingFilesPaths = await glob(`${filePath}.*`, { windowsPathsNoEscape: true });

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

      const response = await fetch(`${penpotApiBaseUrl}/upload-file-media-object`, {
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
    if (!serverValidation) {
      console.warn(
        'the Penpot server-side validation of updates has been disabled. It may lead to a corrupted Penpot file in case the library does not handle all cases properly, so use it with caution'
      );
    }

    // [IMPORTANT] The Penpot scripts defines a default maximum body to 314572800 (300MB) (see `PENPOT_HTTP_SERVER_MAX_MULTIPART_BODY_SIZE`)
    // but this seems not used in their code. The limit reached at runtime is 31457280 (30MB)
    // For huge design systems the limit is easily reached since in adddition we use raw JSON and not the Penpot transit protocol that could help a bit (but would complexify the implementation since no JS Penpot mapper for now)
    // We need to chunk operations if needed
    const bodyLimitBytes = 31_457_280;

    // Removing a hardcoded amount simulating the `Differences` structure
    // It's not perfect but it would add complexity to have it exact
    const remainingBodyBytes = bodyLimitBytes - 1_000_000;

    const totalOperations = differences.newTreeOperations.length;
    let chunkNumber = 1;
    let currentChunkCount = 0;
    let currentChunk: appCommonFilesChanges$changeWithoutUnknown[] = [];
    let currentGroupId: string | null = null;
    let currentGroupCount: number = 0;
    let succeededOperations = 0;

    const pushSpinner = ora(`Pushing modifications to Penpot file "${penpotDocumentId}" (${totalOperations} operation(s))…`).start();
    try {
      for (const { _groupId, _lastOfTheGroup, ...operation } of differences.newTreeOperations) {
        const encodedOperationLength = JSON.stringify(operation).length;

        // Needed to avoid splitting operations that must be processed at the same time by the Penpot backend
        currentGroupId = _groupId && _lastOfTheGroup !== undefined ? _groupId : null;

        // Take into account the `,` delimiter
        if (currentChunkCount + Math.max(currentChunk.length - 1, 0) + encodedOperationLength > remainingBodyBytes) {
          let forwardedOperationsOnNextChunk: typeof currentChunk = [];

          // If currently into a group that cannot be separated, we remove the ongoing ones to set them on the next chunk
          // (being on the last item of the group is fine)
          // Note: it's unlikely a group size would be bigger than the allowed chunk size
          if (currentGroupId && _lastOfTheGroup === false) {
            forwardedOperationsOnNextChunk = currentChunk.splice(-currentChunkCount);
          }

          // Directly process the chunk to not calculate all of them
          pushSpinner.text = `Pushing chunk [${chunkNumber}] (${currentChunk.length} ops, ${succeededOperations}/${totalOperations} done) to Penpot file "${penpotDocumentId}"…`;
          await processOperationsChunk(penpotDocumentId, currentChunk, serverValidation);

          succeededOperations += currentChunk.length;

          // Starting a new chunk
          currentChunk = [...forwardedOperationsOnNextChunk];
          currentChunkCount = currentChunk.length;
          chunkNumber++;
        }

        currentChunk.push(operation);
        currentChunkCount += encodedOperationLength;
        currentGroupCount = currentGroupId ? currentGroupCount + 1 : 0;
      }

      // The last chunk must be processed
      if (currentChunk.length > 0) {
        pushSpinner.text = `Pushing chunk [${chunkNumber}] (${currentChunk.length} ops, ${succeededOperations}/${totalOperations} done) to Penpot file "${penpotDocumentId}"…`;
        await processOperationsChunk(penpotDocumentId, currentChunk, serverValidation);
        succeededOperations += currentChunk.length;
      }

      pushSpinner.succeed(
        `Pushed ${succeededOperations}/${totalOperations} operation(s) across ${chunkNumber} chunk(s) to Penpot file "${penpotDocumentId}"`
      );
    } catch (error) {
      // Stop the spinner first so the recovery warnings below render cleanly (no clash with the animation)
      pushSpinner.fail(`Failed while pushing chunk [${chunkNumber}] to Penpot file "${penpotDocumentId}"`);

      if (succeededOperations > 0) {
        console.warn(`Wait a bit since we are removing processed chunks for your next retry, it will reduce the input and speed up`);

        try {
          differences.newTreeOperations.splice(0, succeededOperations - 1);

          await writeBigJsonFile(getFigmaToPenpotDiffPath(figmaDocumentId, penpotDocumentId), differences);
        } catch (writeError) {
          console.error(
            `it has failed removing processed chunks, please rerun the synchronization from the start to be sure the comparaison is done with the updated Penpot document`
          );

          throw writeError;
        }
      }

      throw error;
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

      const response = await fetch(`${penpotApiBaseUrl}/delete-file-object-thumbnail`, {
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

      if (!response.ok) {
        // If not removed there is a risk of visual defect until there is a modification inside
        // We have no easy way to retry this on the next synchronization because the tree will already be modified
        // Use `text()` (not `json()`) because error responses from this endpoint can be empty
        const body = await response.text();

        console.error(`thumbnail delete failed: ${response.status} ${response.statusText} — ${body || '<empty body>'}`);
        console.warn(`the thumbnail ${oldThumbnail} seems to not be deleted correctly`);
      }
    }
  }
}

export const SetOptions = z.object({
  documents: z.array(DocumentOptions),
  serverValidation: ServerValidation,
  prompting: Prompting,
});
export type SetOptionsType = z.infer<typeof SetOptions>;

export async function set(options: SetOptionsType) {
  // Execute operations onto Penpot instance to match the Figma documents
  // and adjust local mapping with deleted/modified/created nodes
  for (const document of options.documents) {
    const diff = await readFigmaToPenpotDiffFile(document.figmaDocument, document.penpotDocument);

    await processDifferences(document.figmaDocument, document.penpotDocument, diff, options.serverValidation, options.prompting);
  }
}

export const Duration = z.string().transform((val) => {
  // We make it case insensitive because in huge files sometimes common patterns are not exact
  // Note: we rely on the duration format ISO 8601 but we expect only people to specify the time part (after "T")
  return toSeconds(parse(`PT${val.toUpperCase()}`)) * 1000; // Milliseconds
});
export type DurationType = z.infer<typeof Duration>;

// The CLI allows --document and --library to only specify the Figma part, so we need to prompt the user the Penpot destination
export async function resolveDocumentDestinations(documents: DocumentOptionsType[], prompting: boolean): Promise<DocumentOptionsType[]> {
  const needsPrompt = documents.filter((doc) => !doc.penpotDocument);
  if (needsPrompt.length === 0) {
    return documents;
  }

  if (!prompting) {
    throw new Error(
      `${needsPrompt.length} document(s) were passed without a Penpot target and cannot be resolved interactively under --ci. Use ":new" to auto-create or ":<penpotId>" to target an existing file. Affected: ${needsPrompt.map((d) => d.figmaDocument).join(', ')}`
    );
  }

  // Lazily build the choice list once and reuse it across every "existing" prompt in this run
  let cachedFileChoices: Awaited<ReturnType<typeof fetchAllPenpotFileChoices>> | null = null;
  const resolved: DocumentOptionsType[] = [];

  for (const doc of documents) {
    if (doc.penpotDocument) {
      resolved.push(doc);

      continue;
    }

    // Fetch the Figma file's display name so the user can confirm they're answering for the
    // right document. Lazy per prompt — the synced files are typically accessible to the token
    // so this should almost always succeed (unlike library files in resolveBindingsInteractively)
    const figmaFileName = await retrieveFigmaFileName(doc.figmaDocument);
    const figmaLabel = figmaFileName ? `${chalk.yellow(`"${figmaFileName}"`)} (${doc.figmaDocument})` : `"${doc.figmaDocument}"`;

    console.log(`\nNo Penpot target was specified for Figma document ${figmaLabel}.`);

    const action = await select({
      message: 'What do you want to do?',
      choices: [
        {
          name: 'Create a new Penpot file',
          value: 'new',
          description: 'You will pick the team and project on the next prompt; figpot will create the file for you',
        },
        {
          name: 'Pick an existing Penpot file',
          value: 'existing',
          description: 'Lists every Penpot file you have access to',
        },
      ],
    });

    if (action === 'new') {
      resolved.push({ figmaDocument: doc.figmaDocument, penpotDocument: 'new' });

      continue;
    }

    if (!cachedFileChoices) {
      cachedFileChoices = await fetchAllPenpotFileChoices();
    }

    const previouslySyncedPenpotIds = await findRecommendedPenpotIdsForLibrary(doc.figmaDocument);

    const sortedChoices = [...cachedFileChoices].sort((a, b) => {
      const aRec = previouslySyncedPenpotIds.has(a.value) ? 0 : 1;
      const bRec = previouslySyncedPenpotIds.has(b.value) ? 0 : 1;
      return aRec - bRec;
    });

    const decoratedChoices = sortedChoices.map((choice) => ({
      name: previouslySyncedPenpotIds.has(choice.value)
        ? `${choice.name} ${chalk.green.italic('(recommended — previously synced from this Figma file)')}`
        : choice.name,
      value: choice.value,
      disabled: choice.disabled,
    }));

    const penpotId = await select({
      message: `Pick the Penpot file for Figma document ${figmaLabel}:`,
      choices: decoratedChoices,
    });

    if (!uuidValidate(penpotId)) {
      throw new Error(`the selected Penpot file id "${penpotId}" is not a valid UUID`);
    }

    console.log(`\nTo skip this prompt next time, use: ${chalk.cyan(`-d ${doc.figmaDocument}:${penpotId}`)}\n`);

    resolved.push({ figmaDocument: doc.figmaDocument, penpotDocument: penpotId });
  }

  return resolved;
}

// For every document or library passed as `figmaId:new`, prompts the user where to locate this new file
export async function resolveNewPenpotFiles(documents: DocumentOptionsType[], prompting: boolean): Promise<DocumentOptionsType[]> {
  const newCount = documents.filter((doc) => doc.penpotDocument === 'new' || !doc.penpotDocument).length;
  if (newCount === 0) {
    return documents;
  }

  if (!prompting) {
    throw new Error(
      `${newCount} document(s) requested as ":new" but cannot be created interactively under --ci. Pre-create the file in Penpot and pass its id`
    );
  }

  const teams = (await postGetTeams({ requestBody: {} })) as unknown as Array<{
    id: string;
    name: string;
    permissions: { isOwner: boolean; isAdmin: boolean; canEdit: boolean };
  }>;

  const resolved: DocumentOptionsType[] = [];
  for (const doc of documents) {
    if (doc.penpotDocument && doc.penpotDocument !== 'new') {
      resolved.push(doc);

      continue;
    }

    console.log(`\nCreating a new Penpot file for the Figma file "${doc.figmaDocument}"`);

    const teamId = await select({
      message: 'Pick the Penpot team where to create the file:',
      choices: teams.map((team) => ({
        name: team.name,
        value: team.id,
        disabled: team.permissions.canEdit ? false : '(viewer-only, you cannot create files in this team)',
      })),
    });

    // Do not consider projects that have been soft-deleted
    const projects = (await postGetProjects({ requestBody: { teamId } })) as unknown as Array<{ id: string; name: string; deletedAt?: string }>;
    const activeProjects = projects.filter((project) => !project.deletedAt);

    const projectId = await select({
      message: 'Pick the Penpot project where to create the file:',
      choices: activeProjects.map((project) => ({ name: project.name, value: project.id })),
    });

    // The Penpot client types does not yet bring `create-file` response, so for simplicity we force a random UUID to avoid retrieving it
    const penpotFileId = uuidv7();

    // Using temporarily a fallback name, the right one will be set at the synchronization step
    const placeholderName = `figpot: pending first synchronization (${doc.figmaDocument})`;

    await postCreateFile({ requestBody: { name: placeholderName, projectId, id: penpotFileId } });

    // Touch an empty mapping for this freshly created file so the subsequent `restoreMapping`
    // doesn't trigger the "Are you sure to continue by overriding the target document?" prompt:
    // we just created the Penpot file ourselves and know it has no existing content to override
    await saveMapping(doc.figmaDocument, penpotFileId, {
      lastExport: null,
      fonts: new Map(),
      assets: new Map(),
      nodes: new Map(),
      documents: new Map(),
      colors: new Map(),
      typographies: new Map(),
      components: new Map(),
      tokenSets: new Map(),
      tokens: new Map(),
      tokenThemes: new Map(),
    });

    console.log(`Created Penpot file with id "${penpotFileId}" (will be renamed from the Figma title at the end of the synchronization)`);

    console.log(`To skip this prompt next time, use: ${chalk.cyan(`-d ${doc.figmaDocument}:${penpotFileId}`)}\n`);

    resolved.push({ figmaDocument: doc.figmaDocument, penpotDocument: penpotFileId });
  }

  return resolved;
}

// Walks on Penpot teams → projects → files for the authenticated Penpot user and returns pickable file
async function fetchAllPenpotFileChoices(): Promise<Array<{ name: string; value: string; disabled: false | string }>> {
  const teams = (await postGetTeams({ requestBody: {} })) as unknown as Array<{
    id: string;
    name: string;
    permissions: { isOwner: boolean; isAdmin: boolean; canEdit: boolean };
  }>;

  const fileChoices: Array<{ name: string; value: string; disabled: false | string }> = [];

  for (const team of teams) {
    // Do not consider projects that have been soft-deleted
    const projects = (await postGetProjects({ requestBody: { teamId: team.id } })) as unknown as Array<{
      id: string;
      name: string;
      deletedAt?: string;
    }>;

    for (const project of projects) {
      if (project.deletedAt) {
        continue;
      }

      const files = (await postGetProjectFiles({ requestBody: { projectId: project.id } })) as unknown as Array<{
        id: string;
        name: string;
        deletedAt?: string;
      }>;

      for (const file of files) {
        if (file.deletedAt) {
          // Avoid listing soft-deleted files
          continue;
        }

        fileChoices.push({
          name: `${team.name} › ${project.name} › ${file.name}`,
          value: file.id,
          disabled: team.permissions.canEdit ? false : '(viewer-only team, you cannot sync into this file)',
        });
      }
    }
  }

  return fileChoices;
}

// Returns the set of Penpot file ids this user previously synced this Figma source into
async function findRecommendedPenpotIdsForLibrary(figmaFileKey: string): Promise<Set<string>> {
  const recommended = new Set<string>();
  const exportPath = path.resolve(getFigmaDocumentPath(figmaFileKey), 'export');

  if (!fsSync.existsSync(exportPath)) {
    return recommended;
  }

  const entries = await fs.readdir(exportPath);
  for (const entry of entries) {
    const match = entry.match(/^penpot_(.+)$/);
    if (match) {
      recommended.add(match[1]);
    }
  }

  return recommended;
}

// Prompts the user to pick a Penpot file for every Figma library referenced by the synced documents
// that is neither passed as a document or library (if libraries were not explicitly skipped). And throws under `--ci`
//
// Options will be to bind to an existing Penpot file, skip referencing it or stop the run to first synchronize that library separately
export async function resolveBindingsInteractively(
  documents: DocumentOptionsType[],
  declaredLibraries: DocumentOptionsType[],
  prompting: boolean
): Promise<DocumentOptionsType[]> {
  const declaredFigmaFiles = new Set([...documents.map((doc) => doc.figmaDocument), ...declaredLibraries.map((lib) => lib.figmaDocument)]);

  const unboundFigmaFiles = new Set<string>();
  for (const doc of documents) {
    const remoteComponents = await readFigmaRemoteComponentsFile(doc.figmaDocument);

    for (const sourceFigmaFile of Object.values(remoteComponents)) {
      if (!declaredFigmaFiles.has(sourceFigmaFile)) {
        unboundFigmaFiles.add(sourceFigmaFile);
      }
    }
  }

  if (unboundFigmaFiles.size === 0) {
    return [];
  }

  if (!prompting) {
    throw new Error(
      `${unboundFigmaFiles.size} Figma library file(s) are referenced but not bound: ${[...unboundFigmaFiles].join(', ')}. ` +
        `Pass "-l <figmaFileId>:<penpotFileId>" for each, or "--skip-libraries"`
    );
  }

  // Build a "Team › Project › File" choice list once and reuse it for every unbound library prompt
  const fileChoices = await fetchAllPenpotFileChoices();

  // Sentinel values for the two non-pick choices. UUIDs cannot collide with these
  const SKIP_VALUE = '__skip__';
  const STOP_AND_SYNC_VALUE = '__stop_and_sync__';

  // Figma has no batch "fetch metadata for these keys" endpoint, doing in in parallel to avoid blocking on each submitted prompt
  const figmaLibraryNames = new Map<string, string | undefined>();

  const namesSpinner = ora(`Fetching names of ${unboundFigmaFiles.size} referenced Figma libraries…`).start();
  try {
    await Promise.all(
      [...unboundFigmaFiles].map(async (key) => {
        const name = await retrieveFigmaFileName(key);

        figmaLibraryNames.set(key, name);
      })
    );

    namesSpinner.succeed(`Fetched names of ${unboundFigmaFiles.size} referenced Figma libraries`);
  } catch (error) {
    namesSpinner.fail('Failed to fetch some Figma library names');

    throw error;
  }

  const resolved: DocumentOptionsType[] = [];
  const queuedForSeparateSync: string[] = [];
  const skippedFigmaFiles: string[] = [];
  const unboundFigmaFilesList = [...unboundFigmaFiles];

  // Index every library's iteration position so we can know which ones haven't been prompted yet
  // when the user chooses "stop now" those become "also referenced, consider syncing them in the
  // same re-run" suggestions, sparing the user from re-encountering this flow library by library
  let promptedCount = 0;

  for (const figmaFileKey of unboundFigmaFilesList) {
    promptedCount++;
    // "Recommended" hint: if `data/documents/<figmaFileKey>/export/penpot_<id>/` exists, that
    // Penpot file was synced from this Figma library in the past. It's a strong signal it's the right
    // target. Picks up every past sync this user ran from the same working directory
    const previouslySyncedPenpotIds = await findRecommendedPenpotIdsForLibrary(figmaFileKey);

    const sortedFileChoices = [...fileChoices].sort((a, b) => {
      const aRec = previouslySyncedPenpotIds.has(a.value) ? 0 : 1;
      const bRec = previouslySyncedPenpotIds.has(b.value) ? 0 : 1;
      return aRec - bRec;
    });

    const decoratedChoices: Array<{ name: string; value: string; description?: string; disabled?: boolean | string } | Separator> =
      sortedFileChoices.map((choice) => ({
        name: previouslySyncedPenpotIds.has(choice.value)
          ? `${choice.name} ${chalk.green.italic('(recommended since previously synced from this Figma library)')}`
          : choice.name,
        value: choice.value,
        disabled: choice.disabled,
      }));

    decoratedChoices.push(new Separator());
    decoratedChoices.push({
      name: 'Skip referencing this library',
      value: SKIP_VALUE,
      description: 'Useful when your Figma access token does not have access to the source library, but cross-file instances will land detached',
    });
    decoratedChoices.push({
      name: 'Stop now, I want to synchronize this library first',
      value: STOP_AND_SYNC_VALUE,
      description: 'Exits and prints a hint to add this library as a `-d figmaId:new` document. Re-run to continue',
    });

    // Name was prefetched in parallel above; falls back to just the id if the meta call failed
    const figmaLibraryName = figmaLibraryNames.get(figmaFileKey);
    const figmaLibraryLabel = figmaLibraryName ? `${chalk.yellow(`"${figmaLibraryName}"`)} (${figmaFileKey})` : `"${figmaFileKey}"`;

    const chosenPenpotFileId = await select({
      message: `Figma library file ${figmaLibraryLabel} is referenced, pick the corresponding Penpot file if any:`,
      choices: decoratedChoices,
    });

    if (chosenPenpotFileId === SKIP_VALUE) {
      skippedFigmaFiles.push(figmaFileKey);

      continue;
    }

    if (chosenPenpotFileId === STOP_AND_SYNC_VALUE) {
      queuedForSeparateSync.push(figmaFileKey);

      break;
    }

    if (!uuidValidate(chosenPenpotFileId)) {
      throw new Error(`the selected Penpot file id "${chosenPenpotFileId}" is not a valid UUID`);
    }

    resolved.push({ figmaDocument: figmaFileKey, penpotDocument: chosenPenpotFileId });
  }

  // If the user chose to stop & synchronize libraries first, print a hint with the flags to add and
  // exit gracefully. We do NOT auto-recurse because a Figma library may itself reference other
  // libraries, leading to deep cascades that could be not wanted by the user
  if (queuedForSeparateSync.length > 0) {
    const formatFlag = (figmaId: string): string => {
      const name = figmaLibraryNames.get(figmaId);

      return name ? `-d ${figmaId}:new` + chalk.gray(`  # ${name}`) : `-d ${figmaId}:new`;
    };

    const queuedFlags = queuedForSeparateSync.map(formatFlag).join('\n  ');
    const remainingUnprompted = unboundFigmaFilesList.slice(promptedCount);
    const otherUnbound = [...skippedFigmaFiles, ...remainingUnprompted];

    let message = `\nThe following Figma library file(s) need to be synchronized first. Re-run your command with these flags added:\n  ${chalk.cyan(queuedFlags)}\n`;

    if (otherUnbound.length > 0) {
      const otherFlags = otherUnbound.map(formatFlag).join('\n  ');

      message +=
        `\nNote: ${otherUnbound.length} other Figma library(ies) are also referenced and currently unbound. ` +
        `Since you are re-running the command anyway, you may want to synchronize them in the same run — otherwise their instances will land detached on Penpot, and you will re-encounter this prompt next time. ` +
        `To include them as new Penpot files, add:\n  ${chalk.cyan(otherFlags)}\n`;
    }

    message += `\n(cross-file references use deterministic IDs so the order of co-synced documents does not matter)\n`;

    console.log(message);

    return Promise.reject(new UserCancellationExit());
  }

  if (resolved.length > 0) {
    const additionalFlags = resolved.map((binding) => `-l ${binding.figmaDocument}:${binding.penpotDocument}`).join(' ');

    console.log(`\nTo skip these prompts next time, append to your command: ${chalk.cyan(additionalFlags)}\n`);
  }

  return resolved;
}

export const SynchronizeOptions = z.object({
  documents: z.array(DocumentOptions),
  excludePatterns: ExcludePatterns,
  replaceFontPatterns: z.array(ReplaceFontPattern),
  hydrate: z.boolean(),
  hydrateTimeout: Duration.nullable(),
  syncMappingWithGit: z.boolean(),
  serverValidation: ServerValidation,
  prompting: Prompting,
  useCachedFigmaData: z.boolean(),
  libraries: z.array(DocumentOptions).default([]),
  skipLibraries: z.boolean().default(false),
});
export type SynchronizeOptionsType = z.infer<typeof SynchronizeOptions>;

export async function synchronize(options: SynchronizeOptionsType) {
  // Resolve Penpot file IDs for those that need to be created
  // Note: the CLI made sure missing penpot value got promoted to either `'new'` or a real UUID
  const resolvedOptions: SynchronizeOptionsType = {
    ...options,
    documents: await resolveNewPenpotFiles(options.documents, options.prompting === true),
    libraries: await resolveNewPenpotFiles(options.libraries, options.prompting === true),
  };

  await retrieve({
    documents: resolvedOptions.documents,
    libraries: resolvedOptions.libraries,
    prompting: resolvedOptions.prompting,
    syncMappingWithGit: resolvedOptions.syncMappingWithGit,
    useCachedFigmaData: resolvedOptions.useCachedFigmaData,
    skipLibraries: resolvedOptions.skipLibraries,
  });

  // Bind any unresolved library files interactively before transform sees them
  const interactiveBindings = resolvedOptions.skipLibraries
    ? []
    : await resolveBindingsInteractively(resolvedOptions.documents, resolvedOptions.libraries, resolvedOptions.prompting === true);

  const allLibraries = [...resolvedOptions.libraries, ...interactiveBindings];

  await transform({
    documents: resolvedOptions.documents,
    excludePatterns: resolvedOptions.excludePatterns,
    replaceFontPatterns: resolvedOptions.replaceFontPatterns,
    syncMappingWithGit: resolvedOptions.syncMappingWithGit,
    prompting: resolvedOptions.prompting,
    libraries: allLibraries,
  });
  await compare(resolvedOptions);
  await set(resolvedOptions);

  // Dclare a link from every synced document to every library file (including sibling co-synced documents)
  if (!resolvedOptions.skipLibraries) {
    const libraryFiles = new Map<string, string>();

    for (const doc of resolvedOptions.documents) {
      libraryFiles.set(doc.figmaDocument, doc.penpotDocument);
    }

    for (const lib of allLibraries) {
      libraryFiles.set(lib.figmaDocument, lib.penpotDocument);
    }

    for (const consumer of resolvedOptions.documents) {
      for (const [figmaLibraryId, penpotLibraryId] of libraryFiles) {
        if (figmaLibraryId === consumer.figmaDocument) {
          continue; // No need to link a file to itself
        }

        try {
          await postLinkFileToLibrary({
            requestBody: {
              fileId: consumer.penpotDocument,
              libraryId: penpotLibraryId,
            },
          });
        } catch (error) {
          // Penpot returns 400 when the link already exists, which is fine
          console.warn(`could not link Penpot file ${consumer.penpotDocument} to library ${penpotLibraryId} (it may already be linked)`);
        }
      }
    }
  }

  if (!resolvedOptions.hydrate) {
    console.warn(
      `synchronization is complete, but some graphical enhancements can only be done from a browser. If modifications were pushed, the first user opening each updated document may encounter loadings of a few seconds or minutes depending on the size of the document(s). We advise you to perform a hydration yourself so the next viewer sees everything directly. Either open each document in the browser, or rerun this command without "--no-hydrate", or use the dedicated command "figpot document hydrate ..."`
    );

    return;
  }

  await hydrate({
    documents: resolvedOptions.documents,
    timeout: resolvedOptions.hydrateTimeout,
  });
}

export function formatPenpotPageUrl(baseUrl: string, teamId: string, documentId: string, pageId: string): string {
  return `${baseUrl}/#/workspace?team-id=${teamId}&file-id=${documentId}&page-id=${pageId}`;
}

export const HydrateOptions = z.object({
  documents: z.array(DocumentOptions),
  timeout: Duration.nullable(),
});
export type HydrateOptionsType = z.infer<typeof HydrateOptions>;

export async function hydrate(options: HydrateOptionsType) {
  // Get the UI access token (short-lived) (the API access token would not compatible for the following actions)
  // Note: this is inspired by `postCommandLoginWithPassword()` but we need to catch the response cookie header
  const response = await fetch(`${penpotApiBaseUrl}/login-with-password`, {
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
    details = config.penpotUserPassword !== '' ? details.replaceAll(config.penpotUserPassword, '********') : details;

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
    // [IMPORTANT] It has to be headful otherwise it won't pass the Cloudflare protection on their SaaS production
    headless: false,
    args: [
      '--window-size=1,1', // It does not work as expected, `viewport` in the browser context must also be set (note there is no working way to minimize the window)
    ],
  });

  try {
    const browserContext = await browser.newContext({
      viewport: { width: 1, height: 1 }, // Since the window size won't take 1x1px, we make sure the viewport is, like that the user should not be tempted to interact with the page whereas nothing must be touched
    });
    const baseUrl = process.env.PENPOT_BASE_URL || 'https://design.penpot.app';
    const domain = new URL(baseUrl).host;

    if (baseUrl.endsWith('/')) {
      throw new Error(`the penpot base url must not end with "/" to avoid hydratation navigation issues`);
    }

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
      console.log(
        `it may take from 30 seconds to minutes depending on the document size and if this one is synchronized for the first time (the first time roughly N minutes for N file pages)`
      );
      console.warn(
        `a chomium window will open to perform the hydratation, please do not close it or change url (note it has to be visible otherwise it would not pass the cloudflare protection on the penpot production)`
      );

      const meta = await restoreMeta(document.figmaDocument, document.penpotDocument);

      // Check we have the needed information into the `meta.json`
      if (meta.penpotTeamId === 'not_known_yet') {
        throw new Error(`to run hydratation you must first run the synchronization on this document on this machine`);
      }

      const page = await browserContext.newPage();

      try {
        const endpointsToWatch = ['/api/main/methods/update-file?', '/api/main/methods/create-file-object-thumbnail?'];
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
                const pageUrl = formatPenpotPageUrl(baseUrl, meta.penpotTeamId, document.penpotDocument, pageToWatch);

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
            if (stage === 'start' && url.includes('/api/main/methods/get-file?')) {
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

          const firstPageUrl = formatPenpotPageUrl(baseUrl, meta.penpotTeamId, document.penpotDocument, firstPageToWatch);

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
