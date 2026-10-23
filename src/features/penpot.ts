import svgPathParser from 'svg-path-parser';

import { PostGetFileResponse } from '@figpot/src/clients/penpot';
import {
  formatPageRootFrameId,
  rootFrameId,
  translateTokenId,
  translateTokenSetId,
  translateTokenThemeId,
} from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { Token, TokenSet, TokenTheme, TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';
import { penpotBaseUrl } from '@figpot/src/utils/environment';

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

// Since Penpot v2.19 the activation status is stored apart from the tokens library, with identifiers
type TokensStatus = { activeThemeIds?: string[]; activeSetIds?: string[] };

// Theme Penpot creates on its own to hold the sets activated without any theme, it's not ours to manage
const PENPOT_HIDDEN_THEME_NAME = '__PENPOT__HIDDEN__TOKEN__THEME__';

// DTCG reserved properties of a group or a token (token names may start with `$` too, like `$shadow-md`)
const DTCG_RESERVED_PROPERTIES = new Set(['$value', '$type', '$description', '$extensions']);

function isDtcgToken(value: unknown): value is DtcgToken {
  return typeof value === 'object' && value !== null && '$value' in value;
}

// Tokens whose name contains dots are nested by Penpot into groups (`a.b.c` is stored as `{ a: { b: { c: token } } }`)
function flattenDtcgTokens(group: Record<string, unknown>, prefix: string, tokens: Record<string, DtcgToken>) {
  for (const [key, value] of Object.entries(group)) {
    if (DTCG_RESERVED_PROPERTIES.has(key) || typeof value !== 'object' || value === null) {
      continue;
    }

    const name = prefix ? `${prefix}.${key}` : key;

    if (isDtcgToken(value)) {
      tokens[name] = value;
    } else {
      flattenDtcgTokens(value as Record<string, unknown>, name, tokens);
    }
  }
}

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

function extractTokenLibrary(
  tokensLib: TokensLib | undefined,
  tokensStatus: TokensStatus | undefined
): {
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
    const dtcgTokens: Record<string, DtcgToken> = {};
    const tokens: Record<string, Token> = {};

    flattenDtcgTokens(rawValue as Record<string, unknown>, '', dtcgTokens);

    for (const [tokenName, dtcgToken] of Object.entries(dtcgTokens)) {
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
    if (dtcgTheme.name === PENPOT_HIDDEN_THEME_NAME) {
      continue;
    }

    const themePath = dtcgTheme.group ? `${dtcgTheme.group}/${dtcgTheme.name}` : dtcgTheme.name;
    const sets = Object.entries(dtcgTheme.selectedTokenSets ?? {})
      .filter(([, status]) => status === 'enabled' || status === 'source')
      .map(([setPath]) => setPath);

    // The DTCG `id` is an external identifier (not the one used by operations), so the theme identifier is derived
    // like on the Figma side
    const theme: TokenTheme = {
      id: translateTokenThemeId(themePath),
      name: dtcgTheme.name,
      group: dtcgTheme.group ?? '',
      sets: sets,
    };

    if (dtcgTheme.isSource) {
      theme.isSource = true;
    }

    if (dtcgTheme.description) {
      theme.description = dtcgTheme.description;
    }

    tokenThemes[themePath] = theme;
  }

  let activeTokenThemes = tokensLib.$metadata?.activeThemes ?? [];

  if (tokensStatus?.activeThemeIds) {
    activeTokenThemes = Object.entries(tokenThemes)
      .filter(([, theme]) => tokensStatus.activeThemeIds?.includes(theme.id))
      .map(([themePath]) => themePath);
  }

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

    // Penpot sets a zero radius on root frames whereas they cannot have one, the transformation leaves it empty
    for (const radius of ['r1', 'r2', 'r3', 'r4'] as const) {
      if (rootFrameNode[radius] === 0) {
        delete rootFrameNode[radius];
      }
    }

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
        } else if ((object.content as unknown) === '') {
          // An empty shape (e.g. a boolean operation without visible result) has no command
          object.content = [] as unknown as typeof object.content;
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

  const hostedTokensData = hostedTree.data as { tokensLib?: TokensLib; tokensStatus?: TokensStatus } | undefined;
  const { tokenSets, tokenThemes, activeTokenThemes } = extractTokenLibrary(hostedTokensData?.tokensLib, hostedTokensData?.tokensStatus);

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

let penpotVersionPromise: Promise<{ major: number; minor: number } | null> | null = null;

// The Penpot API is not versioned, so some operations depend on the instance version (exposed by the frontend)
export function retrievePenpotVersion(): Promise<{ major: number; minor: number } | null> {
  if (!penpotVersionPromise) {
    penpotVersionPromise = (async () => {
      try {
        const response = await fetch(`${penpotBaseUrl}/version.txt`);
        const match = response.ok ? (await response.text()).match(/^(\d+)\.(\d+)/) : null;

        return match ? { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) } : null;
      } catch {
        return null;
      }
    })();
  }

  return penpotVersionPromise;
}

// Since Penpot v2.19 the activation of token themes is done with `set-tokens-status` (with identifiers) instead of `set-active-token-themes` (with paths)
export async function penpotSupportsTokensStatus(): Promise<boolean> {
  const version = await retrievePenpotVersion();

  if (!version) {
    console.warn(`the Penpot version of "${penpotBaseUrl}" cannot be retrieved, considering it older than v2.19`);

    return false;
  }

  return version.major > 2 || (version.major === 2 && version.minor >= 19);
}
