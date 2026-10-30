import archiver from 'archiver';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { isPageRootFrameFromId, nullId, rootFrameId } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { JsonPath, streamBigJsonFileValues } from '@figpot/src/utils/file';
import { deterministicUuid } from '@figpot/src/utils/uuid';

// Penpot imports `.penpot` files (binfile v3: a zip of JSON entries, one per file, page, shape, component, color...) in one
// request, whereas the API applies changes on an existing file. So it is an alternative to create a file from scratch
// Ref: https://github.com/penpot/penpot/blob/develop/backend/src/app/binfile/v3.clj

// The tree is built against the format of the Penpot version figpot targets, so the archive declares this format as is:
// the importing instance only applies the migrations it knows and that are missing from this list (a newer instance
// upgrades the content as for any older file, an older instance ignores the names it does not know)
// Note: lists taken from a file exported by Penpot v2.19
export const penpotArchiveFileVersion = 67;
export const penpotArchiveFileFeatures = [
  'fdata/path-data',
  'design-tokens/v1',
  'variants/v1',
  'layout/grid',
  'components/v2',
  'fdata/shape-data-type',
];
export const penpotArchiveFileMigrations = [
  ...[
    2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
    49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 62, 65, 66, 67,
  ].map((version) => `legacy-${version}`),
  '0001-remove-tokens-from-groups',
  '0002-normalize-bool-content-v2',
  '0002-clean-shape-interactions',
  '0003-fix-root-shape',
  '0003-convert-path-content-v2',
  '0005-deprecate-image-type',
  '0006-fix-old-texts-fills',
  '0008-fix-library-colors-v4',
  '0009-clean-library-colors',
  '0009-add-partial-text-touched-flags',
  '0010-fix-swap-slots-pointing-non-existent-shapes',
  '0011-fix-invalid-text-touched-flags',
  '0012-fix-position-data',
  '0013-fix-component-path',
  '0013-clear-invalid-strokes-and-fills',
  '0014-fix-tokens-lib-duplicate-ids',
  '0014-clear-components-nil-objects',
  '0015-fix-text-attrs-blank-strings',
  '0015-clean-shadow-color',
  '0016-copy-fills-from-position-data-to-text-node',
  '0017-fix-layout-flex-dir',
  '0018-remove-unneeded-objects-from-components',
  '0019-fix-missing-swap-slots',
  '0020-sync-component-id-with-near-main',
  '0021-fix-shape-svg-attrs',
  '0022-normalize-component-root-and-resync',
  '0023-repair-token-themes-with-inexistent-sets',
  '0024b-fix-stroke-cap-placement',
  '0025-repair-empty-text-content',
  '0026-fix-svg-raw-shapes-uuids',
  '0027-separate-tokens-status',
  '0028-normalize-constrained-values',
  '0029-move-background-blur-out-of-blur',
  '0030-remove-stroke-per-side-attr',
  '0031-migrate-stroke-width-token-attr',
  '0032-fix-children-not-in-parent',
  '0033-normalize-main-instance-names',
];

// Same slug as Penpot (`cuerdas` `slug`), used at import to find the library a file depends on among the shared files of
// the destination team (there must be exactly one with this slug)
export function slugifyPenpotName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type PathCommand = {
  command: string;
  params?: Record<string, number>;
};

// The API accepts path contents as a list of commands whereas a file entry must use the SVG path syntax
export function formatPathContent(commands: PathCommand[]): string {
  return commands
    .map(({ command, params = {} }) => {
      switch (command) {
        case 'move-to':
          return `M${params.x},${params.y}`;
        case 'line-to':
          return `L${params.x},${params.y}`;
        case 'curve-to':
          return `C${params.c1x},${params.c1y},${params.c2x},${params.c2y},${params.x},${params.y}`;
        case 'close-path':
          return 'Z';
        default:
          throw new Error(`the path command "${command}" cannot be written into a Penpot file`);
      }
    })
    .join('');
}

// Token names are paths separated by dots whereas a file entry nests them (DTCG format)
export function formatTokensEntry(data: PenpotDocument['data']) {
  const tokens: Record<string, unknown> = {};

  for (const [setName, set] of Object.entries(data.tokenSets ?? {})) {
    const setTokens: Record<string, any> = {};

    for (const token of Object.values(set.tokens ?? {})) {
      const parts = token.name.split('.');

      let node = setTokens;
      for (const part of parts.slice(0, -1)) {
        node = node[part] ??= {};
      }

      node[parts[parts.length - 1]] = { $value: token.value, $type: token.type, $description: token.description ?? '' };
    }

    tokens[setName] = setTokens;
  }

  const themes = Object.values(data.tokenThemes ?? {});

  tokens.$themes = themes.map((theme) => ({
    id: theme.id,
    name: theme.name,
    group: theme.group ?? '',
    description: theme.description ?? '',
    isSource: theme.isSource ?? false,
    selectedTokenSets: Object.fromEntries(theme.sets.map((setName) => [setName, 'enabled'])),
  }));
  tokens.$metadata = { tokenSetOrder: Object.keys(data.tokenSets ?? {}), activeThemes: [], activeSets: [] };

  // Active themes are referenced by path (`group/name`, the group being possibly empty) and the sets by name
  const activeThemePaths = new Set(data.activeTokenThemes ?? []);
  const activeThemes = themes.filter((theme) => activeThemePaths.has(theme.group ? `${theme.group}/${theme.name}` : theme.name));
  const status = {
    activeThemes: activeThemes.map((theme) => `${theme.group ?? ''}/${theme.name}`),
    activeSets: [...new Set(activeThemes.flatMap((theme) => theme.sets))],
  };

  return { tokens, status };
}

// Shapes are given as they are for the API except figpot internal properties (prefixed by `_`) and the root frame of each
// page that figpot suffixes to have unique identifiers across pages
export function formatShapeEntry(node: Record<string, any>): Record<string, any> {
  const shape: Record<string, any> = {};

  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith('_')) {
      shape[key] = value;
    }
  }

  for (const key of ['id', 'parentId', 'frameId'] as const) {
    if (typeof shape[key] === 'string' && isPageRootFrameFromId(shape[key])) {
      shape[key] = rootFrameId;
    }
  }

  if ((shape.type === 'path' || shape.type === 'bool') && Array.isArray(shape.content)) {
    shape.content = formatPathContent(shape.content);
  }

  return shape;
}

export type PenpotArchiveMedia = {
  id: string; // As referenced by shapes and colors
  mtype: string;
  width: number;
  height: number;
};

export type PenpotArchiveReferences = {
  medias: Map<string, PenpotArchiveMedia>;
  files: Set<string>;
};

// Collects the medias (fills, strokes, colors) and the files (components, colors, typographies) a value refers to
export function collectReferences(value: unknown, references: PenpotArchiveReferences): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferences(item, references);
    }
  } else if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;

    if (typeof object.id === 'string' && typeof object.mtype === 'string' && typeof object.width === 'number' && typeof object.height === 'number') {
      references.medias.set(object.id, { id: object.id, mtype: object.mtype, width: object.width, height: object.height });
    }

    for (const [key, item] of Object.entries(object)) {
      if (key.endsWith('File') && typeof item === 'string') {
        if (item !== nullId) {
          references.files.add(item);
        }
      } else if (typeof item === 'object') {
        collectReferences(item, references);
      }
    }
  }
}

export type PenpotArchiveFile = {
  id: string;
  treePath: string; // Transformed tree written by figpot, read by parts since it can be too big to be loaded at once
  isShared: boolean;
  resolveMediaPath: (mediaId: string) => string | undefined;
};

export type PenpotArchiveExternalLibrary = {
  id: string;
  name: string;
  usedBy: string[];
};

export type PenpotArchive = {
  files: PenpotArchiveFile[];
  externalLibraries: PenpotArchiveExternalLibrary[]; // Libraries expected in the destination team (matched by name)
};

// Same extensions as Penpot uses to find the binary of a storage object
const mediaExtensions: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const libraryCollections = ['components', 'colors', 'typographies'];
const tokenProperties = ['tokenSets', 'tokenThemes', 'activeTokenThemes'];

// Only the values written as entries (or needed to write them) are read from the transformed tree
function isArchivedTreePath(path: JsonPath): boolean {
  if (path.length === 1) {
    return path[0] === 'name';
  } else if (path[0] !== 'data') {
    return false;
  } else if (path.length === 2) {
    return path[1] === 'pages' || tokenProperties.includes(path[1] as string);
  } else if (path.length === 3) {
    return libraryCollections.includes(path[1] as string);
  } else if (path[1] === 'pagesIndex') {
    // Page properties, and each shape of a page
    return (path.length === 4 && path[3] !== 'objects') || (path.length === 5 && path[3] === 'objects');
  }

  return false;
}

// Returns the names of the files as written into the archive
export async function writePenpotArchive(outputPath: string, archive: PenpotArchive): Promise<Map<string, string>> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const output = fsSync.createWriteStream(outputPath);
  // ZIP64 is needed since a big file goes over the 65535 entries limit of the standard format
  const zip = archiver('zip', { zlib: { level: 6 }, forceZip64: true });

  const written = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    zip.on('error', reject);
  });

  zip.pipe(output);

  // Entries are queued in memory until compressed, so the queue is drained regularly to not keep a copy of a whole big file
  let pendingEntries = 0;
  zip.on('entry', () => pendingEntries--);
  const drain = async () => {
    while (pendingEntries > 10_000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const addJson = (name: string, value: unknown) => {
    pendingEntries++;
    zip.append(JSON.stringify(value), { name });
  };

  const names = new Map<string, string>();
  const referencedFiles = new Map<string, Set<string>>();

  // Contents first, the description of the files (needing the links between them) at the end since the order does not matter
  for (const file of archive.files) {
    const filePath = `files/${file.id}`;
    const references: PenpotArchiveReferences = { medias: new Map(), files: new Set() };

    let pageIds: string[] = [];
    const pages = new Map<string, Record<string, unknown>>();
    const tokensData: Record<string, unknown> = {};

    await streamBigJsonFileValues(file.treePath, isArchivedTreePath, async (valuePath, value) => {
      if (valuePath.length === 1) {
        names.set(file.id, value as string);
      } else if (valuePath[1] === 'pages') {
        pageIds = value as string[];
      } else if (tokenProperties.includes(valuePath[1] as string)) {
        tokensData[valuePath[1]] = value;
      } else if (valuePath[1] === 'pagesIndex') {
        const pageId = valuePath[2] as string;

        if (valuePath.length === 4) {
          pages.set(pageId, { ...pages.get(pageId), [valuePath[3]]: value });
        } else {
          const shape = formatShapeEntry(value as Record<string, unknown>);

          collectReferences(shape, references);
          addJson(`${filePath}/pages/${pageId}/${shape.id}.json`, shape);

          await drain();
        }
      } else {
        const collection = valuePath[1] as string;
        const item = collection === 'components' ? formatShapeEntry(value as Record<string, unknown>) : (value as Record<string, unknown>);

        collectReferences(item, references);
        addJson(`${filePath}/${collection}/${item.id}.json`, item);
      }
    });

    for (const [index, pageId] of pageIds.entries()) {
      const page = pages.get(pageId);

      addJson(`${filePath}/pages/${pageId}.json`, { id: pageId, name: page?.name, background: page?.background, index });
    }

    if (Object.keys(tokensData.tokenSets ?? {}).length > 0) {
      const { tokens, status } = formatTokensEntry(tokensData as PenpotDocument['data']);

      addJson(`${filePath}/tokens.json`, tokens);
      addJson(`${filePath}/tokens-status.json`, status);
    }

    // A media is described for the file, and its binary is a storage object shared by the archive
    for (const media of references.medias.values()) {
      const mediaPath = file.resolveMediaPath(media.id);
      if (!mediaPath) {
        throw new Error(`the media ${media.id} is missing locally, it cannot be included into the Penpot file`);
      }

      const extension = mediaExtensions[media.mtype];
      if (!extension) {
        throw new Error(`the media type "${media.mtype}" cannot be written into a Penpot file`);
      }

      const storageObjectId = deterministicUuid(`storage-object/${file.id}/${media.id}`);
      const size = (await fs.stat(mediaPath)).size;

      addJson(`${filePath}/media/${media.id}.json`, {
        id: media.id,
        name: 'unknown', // The original filename is not available from Figma
        width: media.width,
        height: media.height,
        mtype: media.mtype,
        mediaId: storageObjectId,
        isLocal: false,
      });
      addJson(`objects/${storageObjectId}.json`, { id: storageObjectId, size, contentType: media.mtype, bucket: 'file-media-object' });

      pendingEntries++;
      zip.file(mediaPath, { name: `objects/${storageObjectId}${extension}` });
    }

    references.files.delete(file.id);
    referencedFiles.set(file.id, references.files);
  }

  // Links between files of the archive are restored at import, and a file used by another one is a library so it is shared
  const fileIds = new Set(archive.files.map((file) => file.id));
  const relations: [string, string][] = [];

  for (const [fileId, fileReferences] of referencedFiles) {
    for (const libraryId of fileReferences) {
      if (fileIds.has(libraryId)) {
        relations.push([fileId, libraryId]);
      }
    }
  }

  for (const file of archive.files) {
    addJson(`files/${file.id}.json`, {
      id: file.id,
      name: names.get(file.id),
      isShared: file.isShared || relations.some(([, libraryId]) => libraryId === file.id),
      features: penpotArchiveFileFeatures,
      version: penpotArchiveFileVersion,
      migrations: penpotArchiveFileMigrations,
      options: { componentsV2: true },
    });
  }

  addJson('manifest.json', {
    type: 'penpot/export-files',
    version: 1,
    generatedBy: 'figpot',
    referer: 'figpot',
    files: archive.files.map((file) => ({ id: file.id, name: names.get(file.id), features: penpotArchiveFileFeatures })),
    relations: relations,
    externalLibraries: archive.externalLibraries.map((library) => ({
      id: library.id,
      name: library.name,
      slug: slugifyPenpotName(library.name),
      usedBy: library.usedBy,
    })),
  });

  await zip.finalize();
  await written;

  return names;
}
