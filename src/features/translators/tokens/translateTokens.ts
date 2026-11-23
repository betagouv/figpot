import { GetLocalVariablesResponse, LocalVariable, RGBA, VariableAlias } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { hasInferredScope, isMultiTypeVariable, translateScope } from '@figpot/src/features/translators/tokens/translateScope';
import { translateTokenName, translateTokenSetPath, uniqueName } from '@figpot/src/features/translators/tokens/translateTokenName';
import { translateTokenId, translateTokenSetId, translateTokenThemeId } from '@figpot/src/features/translators/translateId';
import { Token, TokenSet, TokenTheme, TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { rgbToHex } from '@figpot/src/utils/color';

export type FigmaVariablesData = GetLocalVariablesResponse['meta'];

export const emptyFigmaVariablesData: FigmaVariablesData = { variables: {}, variableCollections: {} };

export type TranslatedTokens = {
  tokenSets: Record<string, TokenSet>;
  tokenThemes: Record<string, TokenTheme>;
  activeThemes: string[];
  variableTokenNames: Map<string, string>; // composite key `${figmaVariableId}/${tokenType}` -> final Penpot token name
  usedTokenNames: Set<string>; // shared with effect-style tokens so collisions get suffixed globally
  inferredScopeNames: string[]; // variables whose Figma scope was ALL_SCOPES or empty
  suffixedVariableNames: string[]; // variables that ended up split into multiple typed tokens
  aliasesToUnknownNames: string[]; // variables skipped since aliasing a variable the Figma data do not describe
  aliasesToUntokenizedNames: string[]; // variables skipped since aliasing a variable giving no token
};

// Derived from the generated client since the Figma API keeps adding value kinds (like composed colors)
type FigmaVariableValue = LocalVariable['valuesByMode'][string];

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
  resolveAliasName: (variable: LocalVariable, alias: VariableAlias, type: TokenType) => string | undefined,
  mapping: MappingType
): string | string[] | undefined {
  if (isVariableAlias(rawValue)) {
    const aliasName = resolveAliasName(variable, rawValue, type);

    return aliasName !== undefined ? `{${aliasName}}` : undefined;
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
      return [String(rawValue)];
    }
    case 'boolean':
    case 'string':
      return String(rawValue);
    default:
      return Number(rawValue).toString();
  }
}

// A library variable hidden from publishing is not listed by its collection, but variables can alias it: the aliases would
// give no token, so the variables referenced this way (followed through aliases) are added to their collection, unless a
// listed variable of that collection has their name (see `getWrittenEquivalent()`)
export function withReferencedUnlistedVariables(data: FigmaVariablesData): FigmaVariablesData {
  const listedIds = new Set(Object.values(data.variableCollections).flatMap((collection) => collection.variableIds));
  const listedKeys = new Set(
    [...listedIds].flatMap((variableId) => {
      const variable = data.variables[variableId];

      return variable ? [`${variable.variableCollectionId}/${variable.name}`] : [];
    })
  );

  const addedIds = new Map<string, string[]>(); // collection ID -> variable IDs to add
  const queue = [...listedIds].flatMap((variableId) => data.variables[variableId] ?? []);
  const seenIds = new Set(listedIds);

  for (let index = 0; index < queue.length; index++) {
    for (const value of Object.values(queue[index].valuesByMode)) {
      const target = isVariableAlias(value) && !seenIds.has(value.id) ? data.variables[value.id] : undefined;
      if (!target || !data.variableCollections[target.variableCollectionId]) {
        continue;
      }

      seenIds.add(target.id);
      queue.push(target);

      if (!listedKeys.has(`${target.variableCollectionId}/${target.name}`)) {
        addedIds.set(target.variableCollectionId, [...(addedIds.get(target.variableCollectionId) ?? []), target.id]);
      }
    }
  }

  if (addedIds.size === 0) {
    return data;
  }

  const variableCollections = { ...data.variableCollections };
  for (const [collectionId, variableIds] of addedIds) {
    variableCollections[collectionId] = {
      ...variableCollections[collectionId],
      variableIds: [...variableCollections[collectionId].variableIds, ...variableIds],
    };
  }

  return { ...data, variableCollections: variableCollections };
}

export function translateTokens(listedData: FigmaVariablesData, mapping: MappingType): TranslatedTokens {
  const data = withReferencedUnlistedVariables(listedData);

  const tokenSets: Record<string, TokenSet> = {};
  const tokenThemes: Record<string, TokenTheme> = {};
  const activeThemes: string[] = [];

  const usedSetPaths = new Set<string>();
  const usedTokenNames = new Set<string>();
  const variableTokenNames = new Map<string, string>(); // composite key `${variableId}/${type}` -> name
  const inferredScopeNames: string[] = [];
  const suffixedVariableNames: string[] = [];

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

  // The collections whose variables are written, and these variables
  const collections = Object.values(data.variableCollections).filter((collection) => !collection.remote);
  const writtenVariableIds = new Set(
    collections.flatMap((collection) =>
      collection.variableIds.filter((variableId) => data.variables[variableId] && !data.variables[variableId].remote)
    )
  );

  // A library can hold the same variable under two IDs (a copy the file subscribed to and the one its collection lists), an
  // alias may target the one not written: the written variable of the same name in the same collection is used instead
  const writtenVariablesByKey = new Map(
    [...writtenVariableIds].map((variableId) => {
      const variable = data.variables[variableId];

      return [`${variable.variableCollectionId}/${variable.name}`, variable];
    })
  );
  const getWrittenEquivalent = (variable: LocalVariable): LocalVariable =>
    writtenVariableIds.has(variable.id) ? variable : writtenVariablesByKey.get(`${variable.variableCollectionId}/${variable.name}`) ?? variable;

  const isComposedColor = (rawValue: FigmaVariableValue) =>
    typeof rawValue === 'object' && rawValue !== null && 'color' in rawValue && 'opacity' in rawValue;

  // Whether a variable gives a token of a type in at least one of its modes, following its aliases (an alias gives a token
  // only if the variable it aliases does, maybe with another type: a Figma alias has no type, and an `ALL_SCOPES` variable
  // can alias a variable scoped to a single use)
  const givesTokenCache = new Map<string, boolean>();
  const givesToken = (variable: LocalVariable, type: TokenType, visiting = new Set<string>()): boolean => {
    const key = `${variable.id}/${type}`;
    const cached = givesTokenCache.get(key);
    if (cached !== undefined) {
      return cached;
    } else if (visiting.has(key) || !writtenVariableIds.has(variable.id) || !translateScope(variable).includes(type)) {
      return false;
    }

    visiting.add(key);

    const result = Object.values(variable.valuesByMode).some((rawValue) => {
      if (isComposedColor(rawValue)) {
        return false;
      } else if (isVariableAlias(rawValue)) {
        const aliasedVariable = data.variables[rawValue.id];

        return !!aliasedVariable && getAliasedType(getWrittenEquivalent(aliasedVariable), type, visiting) !== undefined;
      }

      return translateTokenValueForType(variable, rawValue, type, () => undefined, mapping) !== undefined;
    });

    givesTokenCache.set(key, result);

    return result;
  };

  // The type of the token an alias refers to: the same type if the aliased variable gives it, or else another one it gives
  const getAliasedType = (aliasedVariable: LocalVariable, type: TokenType, visiting?: Set<string>): TokenType | undefined => {
    const types = translateScope(aliasedVariable);

    return [type, ...types.filter((otherType) => otherType !== type)].find((candidate) => givesToken(aliasedVariable, candidate, visiting));
  };

  // An alias whose target gives no token is skipped (the reference would dangle in Penpot), and reported once whatever
  // the number of its modes and types
  const aliasesToUnknownNames = new Set<string>();
  const aliasesToUntokenizedNames = new Set<string>();
  const resolveAliasName = (variable: LocalVariable, alias: VariableAlias, type: TokenType): string | undefined => {
    const aliasedVariable = data.variables[alias.id];
    if (!aliasedVariable) {
      aliasesToUnknownNames.add(variable.name);

      return undefined;
    }

    const target = getWrittenEquivalent(aliasedVariable);
    const aliasedType = getAliasedType(target, type);
    if (aliasedType === undefined) {
      aliasesToUntokenizedNames.add(variable.name);

      return undefined;
    }

    return getName(target, aliasedType);
  };

  // The tokens are named in the order of the collections before writing any, so the names (made unique in naming order)
  // do not depend on the aliases
  for (const collection of collections) {
    for (const variableId of collection.variableIds) {
      const variable = data.variables[variableId];

      for (const type of variable && writtenVariableIds.has(variableId) ? translateScope(variable) : []) {
        if (givesToken(variable, type)) {
          getName(variable, type);
        }
      }
    }
  }

  for (const collection of collections) {
    for (const mode of collection.modes) {
      const setPath = uniqueName(`${translateTokenSetPath(collection.name)}/${translateTokenSetPath(mode.name)}`, usedSetPaths);
      const tokens: Record<string, Token> = {};

      for (const variableId of collection.variableIds) {
        const variable = data.variables[variableId];
        if (!writtenVariableIds.has(variableId)) {
          continue;
        }

        const rawValue = variable.valuesByMode[mode.modeId];
        if (rawValue === undefined) {
          continue;
        }

        // A color composed with another variable (for its color or its opacity) has no Penpot token equivalent for now
        if (isComposedColor(rawValue)) {
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
          const value = translateTokenValueForType(variable, rawValue, type, resolveAliasName, mapping);
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

  return {
    tokenSets,
    tokenThemes,
    activeThemes,
    variableTokenNames,
    usedTokenNames,
    inferredScopeNames,
    suffixedVariableNames,
    aliasesToUnknownNames: [...aliasesToUnknownNames],
    aliasesToUntokenizedNames: [...aliasesToUntokenizedNames],
  };
}
