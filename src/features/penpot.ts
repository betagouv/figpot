import svgPathParser from 'svg-path-parser';

import { PostGetFileResponse } from '@figpot/src/clients/penpot';
import { formatPageRootFrameId, rootFrameId, translateTokenId, translateTokenSetId } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { Token, TokenSet, TokenTheme, TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

import { translateNonRotatedCommands } from './translators/vectors/translateNonRotatedCommands';

const { parseSVG } = svgPathParser;

// Penpot stores tokens in DTCG / Tokens-Studio shape
type DtcgTokenValue = string | string[];
type DtcgToken = { $value: DtcgTokenValue; $type: string; $description?: string };
type DtcgTheme = {
  id: string;
  name: string;
  group: string;
  description?: string;
  isSource?: boolean;
  selectedTokenSets?: { [setPath: string]: 'enabled' | 'disabled' | 'source' };
};
type DtcgMetadata = { tokenSetOrder?: string[]; activeThemes?: string[]; activeSets?: string[] };

type TokensLib = {
  $themes?: DtcgTheme[];
  $metadata?: DtcgMetadata;
  [setPath: string]: unknown; // Any other top-level key is a token-set path
};

// Penpot's storage layer canonicalises a few token types to the Tokens-Studio plural form even
// though the wire/submit side accepts (and our internal model uses) the singular form
const PLURAL_TO_SINGULAR_TOKEN_TYPE: Record<string, TokenType> = {
  fontFamilies: 'fontFamily',
  fontSizes: 'fontSize',
  fontWeights: 'fontWeight',
};

function normalizeTokenType(dtcgType: string): TokenType {
  return (PLURAL_TO_SINGULAR_TOKEN_TYPE[dtcgType] ?? dtcgType) as TokenType;
}

function extractTokenLibrary(tokensLib: TokensLib | undefined): {
  tokenSets: Record<string, TokenSet>;
  tokenThemes: Record<string, TokenTheme>;
  activeTokenThemes: string[];
} {
  if (!tokensLib) {
    return { tokenSets: {}, tokenThemes: {}, activeTokenThemes: [] };
  }

  // The DTCG wire format strips set / token ids, so we re-derive them with the same deterministic
  // `uuidv5(path)` scheme used on the Figma side (see `translateTokenSetId` / `translateTokenId`).
  // Both sides land on the same UUID for a given setPath / tokenName, so the diff sees existing
  // sets and tokens as unchanged across syncs. A set that exists on Penpot but not in Figma still
  // shows up in `tokenSets` here, so the removal pass emits the appropriate deletion ops
  const tokenSets: Record<string, TokenSet> = {};
  const tokenThemes: Record<string, TokenTheme> = {};

  for (const [key, rawValue] of Object.entries(tokensLib)) {
    if (key === '$themes' || key === '$metadata' || rawValue === undefined) {
      continue;
    }

    const setPath = key;
    const dtcgSet = rawValue as { [tokenName: string]: DtcgToken };
    const tokens: Record<string, Token> = {};

    for (const [tokenName, dtcgToken] of Object.entries(dtcgSet)) {
      const token: Token = {
        id: translateTokenId(setPath, tokenName),
        name: tokenName,
        type: normalizeTokenType(dtcgToken.$type),
        value: dtcgToken.$value,
      };

      if (dtcgToken.$description) {
        token.description = dtcgToken.$description;
      }

      tokens[tokenName] = token;
    }

    tokenSets[setPath] = {
      id: translateTokenSetId(setPath),
      name: setPath,
      tokens: tokens,
    };
  }

  for (const dtcgTheme of tokensLib.$themes ?? []) {
    const themePath = dtcgTheme.group ? `${dtcgTheme.group}/${dtcgTheme.name}` : dtcgTheme.name;
    const sets = Object.entries(dtcgTheme.selectedTokenSets ?? {})
      .filter(([, status]) => status === 'enabled' || status === 'source')
      .map(([setPath]) => setPath);

    const theme: TokenTheme = {
      id: dtcgTheme.id,
      name: dtcgTheme.name,
      group: dtcgTheme.group ?? '',
      isSource: dtcgTheme.isSource ?? false,
      sets: sets,
    };

    if (dtcgTheme.description) {
      theme.description = dtcgTheme.description;
    }

    tokenThemes[themePath] = theme;
  }

  const activeTokenThemes = tokensLib.$metadata?.activeThemes ?? [];

  return { tokenSets, tokenThemes, activeTokenThemes };
}

export function cleanHostedDocument(hostedTree: PostGetFileResponse): PenpotDocument {
  assert(hostedTree.data);

  // Remove fields not meaningful and specific to Penpot and those that are dynamic (so it can be compared to the conversion from Figma)

  const hostedData = hostedTree.data as PenpotDocument['data'];
  const pagesOrder = hostedData.pages;
  const pagesIndex = hostedData.pagesIndex;
  const colors = hostedData.colors;
  const typographies = hostedData.typographies;
  const components = hostedData.components;

  for (const [, page] of Object.entries(pagesIndex)) {
    // To avoid collission about Penpot fixed root frame IDs for each page we adjust
    // the name here so it will match the transformation done from Figma
    const rootFrameKey = rootFrameId;
    const rootFrameNode = page.objects[rootFrameKey];

    assert(rootFrameNode); // Not having the root frame for this page would be abnormal

    const newRootFrameNodeId = formatPageRootFrameId(page.id);

    rootFrameNode.id = newRootFrameNodeId;
    rootFrameNode.parentId = newRootFrameNodeId;
    rootFrameNode.frameId = newRootFrameNodeId;

    // To go fully with this logic, also change the object key
    page.objects[newRootFrameNodeId] = rootFrameNode;
    delete page.objects[rootFrameKey];

    // Then manage the rest of the logic
    for (const [, object] of Object.entries(page.objects)) {
      object.parentId = object.parentId === rootFrameId ? newRootFrameNodeId : object.parentId;
      object.frameId = object.frameId === rootFrameId ? newRootFrameNodeId : object.frameId;

      // We sort them so when it's "refreshed" by the frontend the order won't matter (we did the same into `translateTouched()`)
      if (Array.isArray(object.touched)) {
        object.touched = object.touched.sort();
      }

      if (object.type === 'text') {
        // From the UI this is passed with all position for each texts, it would be really difficult to calculate it
        // on our own. Hopefully they are not required for the text to be correctly created, so ignoring it :)
        delete object.positionData;

        if (object.content?.children) {
          for (const textChild of object.content.children) {
            // Remove a random ID no provided at creation but present when fetching paragraph children (seems not important)
            delete textChild.key;
          }
        }
      } else if (object.type === 'path' || object.type === 'bool') {
        // The new Penpot API is no longer returning an array of commands but instead the inline SVG path.
        // Applies to both `path` and `bool` (boolean-op nodes expose their resolved shape as a path too).
        // We cannot compare it directly with the inline Figma SVG path provided due to logic of calculation, so instead
        // translating from here also to get same things for comparaison (transformed tree has to use commands, it cannot pushes inline path)
        if (typeof object.content === 'string' && (object.content as string).length > 0 && (object.content as string)[0] === 'M') {
          const normalizedPaths = parseSVG(object.content);

          object.content = translateNonRotatedCommands(normalizedPaths, 0, 0);
        }
      }
    }
  }

  if (colors) {
    for (const [, color] of Object.entries(colors)) {
      // Cannot guess this when transforming
      delete color.modifiedAt;
    }
  }

  if (typographies) {
    for (const [, typography] of Object.entries(typographies)) {
      // Cannot guess this when transforming
      delete typography.modifiedAt;
    }
  }

  if (components) {
    for (const [componentIndex, component] of Object.entries(components)) {
      // Penpot performs a soft delete on components for some time, since they are returned by the API we have to ignore them
      if (component.deleted) {
        delete components[componentIndex];
      } else {
        // Cannot guess this when transforming
        delete component.modifiedAt;
      }
    }
  }

  const { tokenSets, tokenThemes, activeTokenThemes } = extractTokenLibrary((hostedTree.data as { tokensLib?: TokensLib } | undefined)?.tokensLib);

  return {
    name: hostedTree.name,
    data: {
      pages: pagesOrder,
      pagesIndex: pagesIndex,
      colors: colors,
      typographies: typographies,
      components: components,
      tokenSets: tokenSets,
      tokenThemes: tokenThemes,
      activeTokenThemes: activeTokenThemes,
    },
  };
}
