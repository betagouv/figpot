import chalk from 'chalk';
import fsSync from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';

import { OpenAPI as PenpotClientSettings } from '@figpot/src/clients/penpot';
import {
  DocumentOptions,
  DocumentOptionsType,
  ExcludePatterns,
  Prompting,
  ReplaceFontPattern,
  getFigmaToPenpotMappingPath,
  getMediasFolderPath,
  getTransformedFigmaTreePath,
  resolveBindingsInteractively,
  restoreMapping,
  retrieve,
  saveMapping,
  transform,
} from '@figpot/src/features/document';
import { FigmaFileMetaCache, retrieveFigmaFileName } from '@figpot/src/features/figma';
import { PenpotArchiveExternalLibrary, PenpotArchiveFile, writePenpotArchive } from '@figpot/src/features/penpotArchive';
import { translateMediaPlaceholderId } from '@figpot/src/features/translators/translateId';
import { penpotApiBaseUrl } from '@figpot/src/utils/environment';
import { deterministicUuid } from '@figpot/src/utils/uuid';

export const ExportOptions = z.object({
  dataDir: z.string(),
  figmaDocuments: z.array(z.string()),
  libraries: z.array(DocumentOptions).default([]),
  skipLibraries: z.boolean().default(false),
  detachedLibraries: z.array(z.string()).default([]),
  skipInferringLibraries: z.boolean().default(false),
  excludePatterns: ExcludePatterns,
  replaceFontPatterns: z.array(ReplaceFontPattern),
  useCachedFigmaData: z.boolean(),
  prompting: Prompting,
  penpotProjectId: z.string().uuid(),
  output: z.string().optional(),
  importIntoProject: z.boolean(),
  shared: z.boolean(),
});
export type ExportOptionsType = z.infer<typeof ExportOptions>;

// An exported document has no Penpot file yet, so it gets a placeholder identifier stable across exports (so its own mapping
// is reused and the shapes keep their identifiers), Penpot gives it a new identifier at import anyway
export function getExportPlaceholderFileId(figmaDocumentId: string): string {
  return deterministicUuid(`export/${figmaDocumentId}`);
}

// An upload is made of parts small enough for proxies limiting the size of requests, but Penpot also limits the number of
// parts per upload (`PENPOT_QUOTES_UPLOAD_CHUNKS_PER_SESSION`, 20 by default), so parts are enlarged for big files
const minimumUploadChunkSize = 20 * 1024 * 1024;
const maximumUploadChunks = 20;

async function penpotRequest(method: string, body: FormData | object, accept: string = 'application/json'): Promise<Response> {
  const response = await fetch(`${penpotApiBaseUrl}/${method}`, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
    headers: {
      Accept: accept,
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: (PenpotClientSettings.HEADERS as any)?.Authorization,
    },
  });

  if (!response.ok) {
    throw new Error(`the Penpot request "${method}" failed (status ${response.status}): ${(await response.text()).slice(0, 2000)}`);
  }

  return response;
}

// Uploads the archive by chunks (it can exceed the maximum size of a request) and imports it, returning the identifiers of
// the created files in the order of the archive manifest
export async function importPenpotArchive(archivePath: string, projectId: string, name: string): Promise<string[]> {
  const size = (await fs.stat(archivePath)).size;
  const uploadChunkSize = Math.max(minimumUploadChunkSize, Math.ceil(size / maximumUploadChunks));
  const totalChunks = Math.max(1, Math.ceil(size / uploadChunkSize));

  const { sessionId } = (await (await penpotRequest('create-upload-session', { totalChunks })).json()) as { sessionId: string };

  const handle = await fs.open(archivePath, 'r');
  try {
    for (let index = 0; index < totalChunks; index++) {
      const buffer = Buffer.alloc(Math.min(uploadChunkSize, size - index * uploadChunkSize));
      await handle.read(buffer, 0, buffer.length, index * uploadChunkSize);

      const formData = new FormData();
      formData.append('session-id', sessionId);
      formData.append('index', String(index));
      formData.append('content', new Blob([new Uint8Array(buffer)]), 'chunk');

      await penpotRequest('upload-chunk', formData);

      console.log(`uploaded the archive part ${index + 1}/${totalChunks}`);
    }
  } finally {
    await handle.close();
  }

  console.log('importing the archive into Penpot, it may take a few minutes for big files…');

  // The import reports its progress as server-sent events, the last one gives the result
  const response = await penpotRequest('import-binfile', { name, projectId, uploadId: sessionId, version: 3 }, 'text/event-stream');
  const content = await response.text();

  let fileIds: string[] | null = null;
  for (const event of content.split('\n\n')) {
    const type = event.match(/^event: (.+)$/m)?.[1];
    const data = event.match(/^data: (.+)$/m)?.[1];

    if (type === 'error') {
      throw new Error(`the import of the archive failed: ${data}`);
    } else if (type === 'end' && data) {
      // Transit encoding: keywords are prefixed with `~:` and UUIDs with `~u`
      const result = JSON.parse(data) as Record<string, unknown>;
      const ids = result['~:file-ids'];

      if (Array.isArray(ids)) {
        fileIds = ids.map((id) => String(id).replace(/^~u/, ''));
      }
    }
  }

  if (!fileIds) {
    throw new Error(`the import of the archive ended without result: ${content.slice(-2000)}`);
  }

  return fileIds;
}

export async function exportDocuments(options: ExportOptionsType, figmaMetaCache: FigmaFileMetaCache = new FigmaFileMetaCache()) {
  if (!options.output && !options.importIntoProject) {
    throw new Error('the export needs an output path for the Penpot file, or to be imported directly into the Penpot project');
  }

  const documents: DocumentOptionsType[] = options.figmaDocuments.map((figmaDocument) => ({
    figmaDocument: figmaDocument,
    penpotDocument: getExportPlaceholderFileId(figmaDocument),
  }));

  // A placeholder file has no previous synchronization to override, so it starts with an empty mapping without prompting
  for (const document of documents) {
    if (!fsSync.existsSync(getFigmaToPenpotMappingPath(options.dataDir, document.figmaDocument, document.penpotDocument))) {
      await saveMapping(
        options.dataDir,
        document.figmaDocument,
        document.penpotDocument,
        await restoreMapping(options.dataDir, document.figmaDocument, document.penpotDocument, false)
      );
    }
  }

  await retrieve(
    {
      dataDir: options.dataDir,
      documents: documents,
      libraries: options.libraries,
      prompting: options.prompting,
      syncMappingWithGit: false,
      useCachedFigmaData: options.useCachedFigmaData,
      skipLibraries: options.skipLibraries,
      skipInferringLibraries: options.skipInferringLibraries,
      penpotProjectId: options.penpotProjectId,
    },
    figmaMetaCache
  );

  const interactiveBindings = options.skipLibraries
    ? []
    : await resolveBindingsInteractively(
        options.dataDir,
        documents,
        options.libraries,
        options.prompting === true,
        options.detachedLibraries,
        figmaMetaCache
      );
  const libraries = [...options.libraries, ...interactiveBindings];

  await transform({
    dataDir: options.dataDir,
    documents: documents,
    excludePatterns: options.excludePatterns,
    replaceFontPatterns: options.replaceFontPatterns,
    syncMappingWithGit: false,
    prompting: options.prompting,
    libraries: libraries,
  });

  // Medias are not uploaded so they are referenced by the placeholder derived from their Figma identifier (the filename)
  const mediaPathsByPlaceholder = new Map<string, string>();
  for (const filename of await fs.readdir(getMediasFolderPath(options.dataDir)).catch(() => [])) {
    mediaPathsByPlaceholder.set(translateMediaPlaceholderId(filename.split('.')[0]), path.resolve(getMediasFolderPath(options.dataDir), filename));
  }

  const documentIds = new Set(documents.map((document) => document.penpotDocument));

  // The transformed trees are read again by parts from the disk since a big one cannot be kept in memory while writing
  const files: PenpotArchiveFile[] = documents.map((document) => ({
    id: document.penpotDocument,
    treePath: getTransformedFigmaTreePath(options.dataDir, document.figmaDocument, document.penpotDocument),
    isShared: options.shared,
    resolveMediaPath: (mediaId) => mediaPathsByPlaceholder.get(mediaId),
  }));

  // Libraries outside the archive are found at import among the shared files of the destination team by their name, which
  // is the one of the Figma file (as set by the synchronization)
  const externalLibraries: PenpotArchiveExternalLibrary[] = [];
  for (const library of libraries) {
    if (documentIds.has(library.penpotDocument)) {
      continue;
    }

    const name = await retrieveFigmaFileName(figmaMetaCache, library.figmaDocument);
    if (!name) {
      console.warn(
        `the name of the Figma library ${library.figmaDocument} cannot be retrieved, so the Penpot file will not be linked to it at import (link it manually from the Penpot interface)`
      );

      continue;
    }

    externalLibraries.push({
      id: library.penpotDocument,
      name,
      // As for the synchronization, every document is linked to the given libraries (even without using them yet)
      usedBy: documents.map((document) => document.penpotDocument),
    });
  }

  const archivePath = options.output
    ? path.resolve(options.output)
    : path.resolve(await fs.mkdtemp(path.join(os.tmpdir(), 'figpot-export-')), 'export.penpot');

  console.log(`writing the Penpot file ${archivePath}…`);

  const names = await writePenpotArchive(archivePath, { files, externalLibraries });

  console.log(`the Penpot file ${archivePath} is ready (${Math.round((await fs.stat(archivePath)).size / 1024 / 1024)} MB)`);

  if (!options.importIntoProject) {
    return;
  }

  try {
    const importedFileIds = await importPenpotArchive(archivePath, options.penpotProjectId, names.get(documents[0].penpotDocument) ?? 'figpot');

    if (importedFileIds.length !== documents.length) {
      throw new Error(`the import created ${importedFileIds.length} file(s) whereas ${documents.length} were expected`);
    }

    // The shapes, components, colors... keep their identifiers at import, so the mapping is moved to the created file to
    // synchronize it later. The medias get new identifiers so they will be uploaded again by the next synchronization
    for (const [index, document] of documents.entries()) {
      const importedFileId = importedFileIds[index];
      const mapping = await restoreMapping(options.dataDir, document.figmaDocument, document.penpotDocument, false);

      for (const [key, value] of mapping.documents) {
        if (value === document.penpotDocument) {
          mapping.documents.set(key, importedFileId);
        }
      }

      await saveMapping(options.dataDir, document.figmaDocument, importedFileId, mapping);

      console.log(`the Figma document ${document.figmaDocument} has been imported into the Penpot file ${importedFileId}`);
    }

    console.log(
      `to synchronize them later, use: ${chalk.cyan(documents.map((document, index) => `-d ${document.figmaDocument}:${importedFileIds[index]}`).join(' '))}`
    );
  } finally {
    if (!options.output) {
      await fs.rm(path.dirname(archivePath), { recursive: true, force: true });
    }
  }
}
