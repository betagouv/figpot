import fs from 'fs';

import { GetLocalVariablesResponse, LocalVariable, LocalVariableCollection, RGBA, VariableAlias } from '@figpot/src/clients/figma';
import { MappingType, ReplaceFontPatternType } from '@figpot/src/features/document';
import { hasInferredScope, isMultiTypeVariable, translateScope } from '@figpot/src/features/translators/tokens/translateScope';
import { translateTokenName, translateTokenSetPath, uniqueName } from '@figpot/src/features/translators/tokens/translateTokenName';
import { translateTokenId, translateTokenSetId, translateTokenThemeId } from '@figpot/src/features/translators/translateId';
import { Token, TokenSet, TokenTheme, TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { rgbToHex } from '@figpot/src/utils/color';

// The Penpot theme of a Figma variable mode set on a node (`explicitVariableModes`), if its collection is known
export function resolveThemeIdForMode(themeIdsByCollectionMode: Map<string, string>, collectionId: string, modeId: string): string | undefined {
  const direct = themeIdsByCollectionMode.get(`${collectionId}/${modeId}`);
  if (direct) {
    return direct;
  }

  // Remote collection IDs are formatted `VariableCollectionId:<collection key>/<local id>`
  const key = collectionId.match(/^VariableCollectionId:([0-9a-f]+)\//)?.[1];

  return key ? themeIdsByCollectionMode.get(`key:${key}/${modeId}`) : undefined;
}

export type FigmaVariablesData = GetLocalVariablesResponse['meta'];

export const emptyFigmaVariablesData: FigmaVariablesData = { variables: {}, variableCollections: {} };

// Experimental "token contexts" mode (Penpot branch with token scopes): every Figma collection becomes a theme group whose
// themes are its modes, the default modes are activated, and the variable modes set on nodes (`explicitVariableModes`)
// become token scopes on the Penpot shapes. Remote collections are kept too since the modes set on nodes mostly target them
export function isTokenContextsEnabled(): boolean {
  return process.env.FIGPOT_TOKEN_CONTEXTS === 'true';
}

export type TranslatedTokens = {
  themeIdsByCollectionMode: Map<string, string>; // `${figmaCollectionId}/${figmaModeId}` -> Penpot theme ID (token contexts mode only)
  tokenSets: Record<string, TokenSet>;
  tokenThemes: Record<string, TokenTheme>;
  activeThemes: string[];
  variableTokenNames: Map<string, string>; // composite key `${figmaVariableId}/${tokenType}` -> final Penpot token name
  usedTokenNames: Set<string>; // shared with effect-style tokens so collisions get suffixed globally
  inferredScopeNames: string[]; // variables whose Figma scope was ALL_SCOPES or empty
  suffixedVariableNames: string[]; // variables that ended up split into multiple typed tokens
};

type FigmaVariableValue = boolean | number | string | RGBA | VariableAlias;

function isVariableAlias(value: FigmaVariableValue): value is VariableAlias {
  return typeof value === 'object' && value !== null && (value as VariableAlias).type === 'VARIABLE_ALIAS';
}

function translateColorValue(color: RGBA): string {
  const hex = rgbToHex(color);

  if (color.a !== undefined && color.a < 1) {
    return `${hex}${Math.round(color.a * 255)
      .toString(16)
      .padStart(2, '0')}`;
  }

  return hex;
}

// Penpot enforces specific values for font-weight
const VALID_NUMERIC_FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

const VALID_NAMED_FONT_WEIGHTS = new Set([
  'thin',
  'thinitalic',
  'extralight',
  'extralightitalic',
  'light',
  'lightitalic',
  'regular',
  'italic',
  'medium',
  'mediumitalic',
  'semibold',
  'semibolditalic',
  'bold',
  'bolditalic',
  'extrabold',
  'extrabolditalic',
  'black',
  'blackitalic',
]);

function isValidNumericFontWeight(value: number): boolean {
  return VALID_NUMERIC_FONT_WEIGHTS.has(value);
}

function isValidNamedFontWeight(value: string): boolean {
  return VALID_NAMED_FONT_WEIGHTS.has(value.replace(/\s+/g, '').toLowerCase());
}

function translateTokenValueForType(
  variable: LocalVariable,
  rawValue: FigmaVariableValue,
  type: TokenType,
  variables: FigmaVariablesData['variables'],
  resolveAliasName: (aliasedVariable: LocalVariable, type: TokenType) => string | undefined,
  mapping: MappingType,
  replaceFontPatterns: ReplaceFontPatternType[] = []
): string | string[] | undefined {
  if (isVariableAlias(rawValue)) {
    const aliasedVariable = variables[rawValue.id];

    // Cross-file alias: REST API does not expose the value and Penpot has no cross-file token refs,
    // so we drop the token rather than emit a dangling reference
    if (!aliasedVariable) {
      console.warn(
        `skipping the token for the Figma variable "${variable.name}" because it aliases a variable from another file, which figpot cannot resolve`
      );
      return undefined;
    }

    // Same when the aliased variable gives no token at all (unsupported values), the reference would dangle
    const aliasName = resolveAliasName(aliasedVariable, type);
    if (aliasName === undefined) {
      console.warn(
        `skipping the token for the Figma variable "${variable.name}" because the variable it aliases ("${aliasedVariable.name}") gives no Penpot token`
      );
      return undefined;
    }

    return `{${aliasName}}`;
  }

  switch (type) {
    case 'color':
      return translateColorValue(rawValue as RGBA);
    case 'opacity':
      return (Number(rawValue) / 100).toString();
    case 'fontWeight': {
      if (typeof rawValue === 'number') {
        return isValidNumericFontWeight(rawValue) ? rawValue.toString() : undefined;
      } else if (typeof rawValue === 'string') {
        return isValidNamedFontWeight(rawValue) ? rawValue : undefined;
      } else {
        return undefined;
      }
    }
    case 'fontFamily': {
      // Penpot's font resolver picks up the array form and looks up the matching font
      // when applying the token to a shape's `fontFamily` slot (if no found it's displaying "Missing font")
      // Redirected like the fonts of the nodes, or applying the token in Penpot would set back a font it does not have
      const fontFamily = String(rawValue);
      const replaceFontPattern = replaceFontPatterns.find((pattern) => pattern.search.test(fontFamily));

      return [replaceFontPattern ? replaceFontPattern.set : fontFamily];
    }
    case 'boolean':
    case 'string':
      return String(rawValue);
    default:
      return Number(rawValue).toString();
  }
}

// The REST API only describes the remote variables a file binds to some nodes: it misses the library collections a file
// only sets a mode of and the targets of aliases. `FIGPOT_EXTRA_VARIABLES` points to a JSON file in the format of the REST
// response (`{ meta: { variableCollections, variables } }`) exported by the `figma-plugins/variables-export` plugin, whose
// Plugin API resolves them from the copies the file keeps. `FIGPOT_EXTRA_VARIABLE_COLLECTIONS` (deprecated) only adds
// collections, so their modes become themes without tokens. The REST data wins on common ids
function withExtraVariables(data: FigmaVariablesData): FigmaVariablesData {
  const extraPath = process.env.FIGPOT_EXTRA_VARIABLES || process.env.FIGPOT_EXTRA_VARIABLE_COLLECTIONS;
  if (!extraPath) {
    return data;
  }

  const content = JSON.parse(fs.readFileSync(extraPath, 'utf-8')) as { meta: Partial<FigmaVariablesData> } | Partial<FigmaVariablesData>;
  const extra = 'meta' in content ? content.meta : content;

  // A remote collection the REST API describes only lists the variables the file binds: its variables are completed with
  // those of the export, which lists all of them
  const variableCollections = { ...extra.variableCollections, ...data.variableCollections };
  for (const [id, extraCollection] of Object.entries(extra.variableCollections ?? {})) {
    const collection = data.variableCollections[id];
    if (collection) {
      variableCollections[id] = {
        ...collection,
        variableIds: [...new Set([...collection.variableIds, ...extraCollection.variableIds])],
      };
    }
  }

  return {
    variables: { ...extra.variables, ...data.variables },
    variableCollections: variableCollections,
  };
}

export function translateTokens(
  originalData: FigmaVariablesData,
  mapping: MappingType,
  replaceFontPatterns: ReplaceFontPatternType[] = []
): TranslatedTokens {
  const data = withExtraVariables(originalData);

  const tokenSets: Record<string, TokenSet> = {};
  const tokenThemes: Record<string, TokenTheme> = {};
  const activeThemes: string[] = [];

  const usedSetPaths = new Set<string>();
  const usedTokenNames = new Set<string>();
  const variableTokenNames = new Map<string, string>(); // composite key `${variableId}/${type}` -> name
  const inferredScopeNames: string[] = [];
  const suffixedVariableNames: string[] = [];
  const themeIdsByCollectionMode = new Map<string, string>();
  const usedGroupNames = new Set<string>();
  const tokenContexts = isTokenContextsEnabled();

  // Resolves (and caches) the final Penpot name for a (variable, type) pair. Computed once, reused
  // across every mode the variable appears in so collision suffixes do not drift between modes
  const getName = (variable: LocalVariable, type: TokenType): string => {
    const key = `${variable.id}/${type}`;
    const cached = variableTokenNames.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const baseName = translateTokenName(variable.name);

    // Hyphen instead of `.` because Penpot interprets `.` as a group separator: `font.fontFamily`
    // would nest inside a `font` folder and the clickable target shrinks to the leaf
    const proposal = isMultiTypeVariable(variable) ? `${baseName}-${type}` : baseName;
    const finalName = uniqueName(proposal, usedTokenNames);

    variableTokenNames.set(key, finalName);

    return finalName;
  };

  // The name of the token an alias refers to: the token of the aliased variable with the same type, or else one of the
  // types it does give (a Figma alias has no type, an `ALL_SCOPES` variable can alias a variable scoped to a single
  // use). Only names of tokens that exist: naming a (variable, type) pair the aliased variable does not give would
  // reserve a name for a token never written, so the reference would dangle and push the real token to a `-1` name
  const resolveAliasName = (aliasedVariable: LocalVariable, type: TokenType): string | undefined => {
    const sameType = variableTokenNames.get(`${aliasedVariable.id}/${type}`);
    if (sameType !== undefined) {
      return sameType;
    }

    for (const otherType of translateScope(aliasedVariable)) {
      const name = variableTokenNames.get(`${aliasedVariable.id}/${otherType}`);
      if (name !== undefined) {
        return name;
      }
    }

    return undefined;
  };

  // With token contexts, the collections sharing a key are one family: Figma "extended collections" keep the key and the
  // mode IDs of the collection they extend, and setting a mode of the parent on a node also switches the variables of its
  // extensions (a node can set the mode of an empty parent collection whose variables all live in an extension). A family is one theme group whose
  // theme of a mode activates the sets of every member for that mode. Without token contexts each collection stays alone
  const families = new Map<string, LocalVariableCollection[]>();
  for (const collection of Object.values(data.variableCollections)) {
    if (collection.remote && !tokenContexts) {
      continue;
    }

    const familyKey = tokenContexts && collection.key ? `key:${collection.key}` : `id:${collection.id}`;
    families.set(familyKey, [...(families.get(familyKey) ?? []), collection]);
  }

  // The variables to translate with their values, in the order tokens are written
  const collectVariableModes = (collection: LocalVariableCollection, modeId: string) =>
    collection.variableIds.flatMap((variableId) => {
      const variable = data.variables[variableId];
      if (!variable || (variable.remote && !tokenContexts)) {
        return [];
      }

      const rawValue = variable.valuesByMode[modeId];

      return rawValue === undefined ? [] : [{ variable: variable, rawValue: rawValue }];
    });

  // First pass: name every token that will be written (an alias is assumed valid here, its target is checked when
  // writing), so references only use names of written tokens whatever the order collections come in
  for (const members of families.values()) {
    for (const collection of members) {
      for (const mode of collection.modes) {
        for (const { variable, rawValue } of collectVariableModes(collection, mode.modeId)) {
          if (typeof rawValue === 'object' && rawValue !== null && 'color' in rawValue && 'opacity' in rawValue) {
            continue;
          }

          for (const type of translateScope(variable)) {
            if (
              isVariableAlias(rawValue) ||
              translateTokenValueForType(variable, rawValue, type, data.variables, () => undefined, mapping) !== undefined
            ) {
              getName(variable, type);
            }
          }
        }
      }
    }
  }

  for (const members of families.values()) {
    // Named after the member holding the most variables (the one designers see the values of), without the "❖" mark
    // Figma shows on extensions, and unique since two libraries can have collections with the same name
    const namingMember = [...members].sort((a, b) => b.variableIds.length - a.variableIds.length)[0];
    const baseGroupName = tokenContexts ? namingMember.name.replace(/^❖\s*/, '') : namingMember.name;
    const groupName = tokenContexts ? uniqueName(baseGroupName, usedGroupNames) : baseGroupName;
    const familyThemes = new Map<string, { name: string; sets: string[]; emptySets: string[]; collections: LocalVariableCollection[] }>();

    for (const collection of members) {
      const setGroupName = members.length > 1 ? collection.name.replace(/^❖\s*/, '') : groupName;

      for (const mode of collection.modes) {
        const setPath = uniqueName(`${translateTokenSetPath(setGroupName)}/${translateTokenSetPath(mode.name)}`, usedSetPaths);
        const tokens: Record<string, Token> = {};

        for (const { variable, rawValue } of collectVariableModes(collection, mode.modeId)) {
          // A color composed with another variable (for its color or its opacity) has no Penpot token equivalent for now
          if (typeof rawValue === 'object' && rawValue !== null && 'color' in rawValue && 'opacity' in rawValue) {
            console.warn(
              `skipping the token for the Figma variable "${variable.name}" because its color is composed with another variable, which figpot cannot translate`
            );

            continue;
          }

          const types = translateScope(variable);

          // Track warning-surface lists once per variable (the inner loop runs again for every mode
          // but the names array would just grow with duplicates, so guard on first occurrence)
          if (hasInferredScope(variable) && !inferredScopeNames.includes(variable.name)) {
            inferredScopeNames.push(variable.name);
          }

          if (types.length > 1 && !suffixedVariableNames.includes(variable.name)) {
            suffixedVariableNames.push(variable.name);
          }

          for (const type of types) {
            const value = translateTokenValueForType(variable, rawValue, type, data.variables, resolveAliasName, mapping, replaceFontPatterns);
            if (value === undefined) {
              continue;
            }

            const name = getName(variable, type);
            tokens[name] = {
              id: translateTokenId(setPath, name),
              name: name,
              type: type,
              value: value,
              description: variable.description || undefined,
            };
          }
        }

        tokenSets[setPath] = {
          id: translateTokenSetId(setPath),
          name: setPath,
          tokens: tokens,
        };

        if (tokenContexts) {
          const familyTheme = familyThemes.get(mode.modeId) ?? { name: mode.name, sets: [], emptySets: [], collections: [] };
          (Object.keys(tokens).length > 0 ? familyTheme.sets : familyTheme.emptySets).push(setPath);
          familyTheme.collections.push(collection);
          familyThemes.set(mode.modeId, familyTheme);
        }

        // Token themes are intentionally NOT emitted at sync. Penpot's set picker is multi-select
        // and works directly on sets — themes are purely user-defined bundles that toggle several
        // sets at once. Figma's data has no cross-collection grouping we could read to deduce a
        // useful bundle (e.g. "this Colors mode goes with this Spacing mode"), so any theme we
        // auto-emit would just be a one-button alias for the matching set's checkbox — pure noise.
        //
        // The plumbing below is kept ready so that, if a user wants named themes (typical when a
        // file is published once and not re-synced regularly), they can create them by hand in
        // Penpot's UI; we still own the id mapping via `translateTokenThemeId` should we ever
        // re-introduce automatic emission (e.g. via a future CLI hint or a Figma-side convention).
        //
        // tokenThemes[setPath] = {
        //   id: translateTokenThemeId(`xxx`, mapping),
        //   name: themeName,
        //   group: themeGroup,
        //   sets: [yyy],
        // };
      }
    }

    for (const [modeId, familyTheme] of familyThemes) {
      const themePath = `${groupName}/${familyTheme.name}`;
      const themeId = translateTokenThemeId(themePath, mapping);

      tokenThemes[themePath] = {
        id: themeId,
        name: familyTheme.name,
        group: groupName,
        // The empty sets of the family only when no member has tokens for this mode, so the theme still has a set
        // Sorted since Penpot keeps them as a set: the comparison would otherwise see a difference from the order alone
        sets: [...(familyTheme.sets.length > 0 ? familyTheme.sets : familyTheme.emptySets)].sort(),
      };

      for (const collection of familyTheme.collections) {
        themeIdsByCollectionMode.set(`${collection.id}/${modeId}`, themeId);

        // The REST API only lists the extended collections when the file binds their variables: a mode set on a node
        // through an unlisted member of the family is matched by key (see `resolveThemeIdForMode()`)
        if (collection.key && !themeIdsByCollectionMode.has(`key:${collection.key}/${modeId}`)) {
          themeIdsByCollectionMode.set(`key:${collection.key}/${modeId}`, themeId);
        }
      }

      if (modeId === namingMember.defaultModeId) {
        activeThemes.push(themePath);
      }
    }
  }

  return {
    themeIdsByCollectionMode,
    tokenSets,
    tokenThemes,
    activeThemes,
    variableTokenNames,
    usedTokenNames,
    inferredScopeNames,
    suffixedVariableNames,
  };
}
