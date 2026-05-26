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
  variableCollectionIds: Map<string, string>; // Figma variable id -> the Figma collection it belongs to
  variableDefaultValues: Map<string, number | string>; // composite key `${figmaVariableId}/${tokenType}` -> Penpot-shape default-mode value
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
  resolveAliasName: (aliasedVariable: LocalVariable, type: TokenType) => string,
  mapping: MappingType
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

    return `{${resolveAliasName(aliasedVariable, type)}}`;
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

// Walks a variable's default-mode value, following alias chains until it hits a raw value (or
// returns undefined when the chain leaves the file / loops on itself). Used at the post-pass below
// to precompute per-variable "active theme value" for the registry
function resolveDefaultModeRaw(
  variable: LocalVariable,
  variables: FigmaVariablesData['variables'],
  collections: FigmaVariablesData['variableCollections'],
  visited: Set<string> = new Set()
): boolean | number | string | RGBA | undefined {
  if (visited.has(variable.id)) {
    return undefined;
  }

  visited.add(variable.id);

  const collection = collections[variable.variableCollectionId];
  if (!collection) {
    return undefined;
  }

  const value = variable.valuesByMode[collection.defaultModeId];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'object' && value !== null && (value as VariableAlias).type === 'VARIABLE_ALIAS') {
    const aliased = variables[(value as VariableAlias).id];

    if (!aliased) {
      return undefined;
    }

    return resolveDefaultModeRaw(aliased, variables, collections, visited);
  }

  return value as boolean | number | string | RGBA;
}

// Maps a default-mode raw value to the Penpot **shape** value (what gets written onto a node's
// static property: `r1: 16`, `fillColor: '#ffffff'`, `opacity: 0.5`, ...). Per-type since the
// numeric scaling and serialisation differs between Penpot properties
function toPenpotShapeValue(raw: boolean | number | string | RGBA, type: TokenType, mapping: MappingType): number | string | undefined {
  switch (type) {
    case 'color':
      // Penpot's shape `fillColor`/`strokeColor` schema accepts ONLY `#rrggbb` (6 chars). Alpha is
      // carried by a separate `fillOpacity`/`strokeOpacity` field, so we drop the alpha component
      // here. Token values use the alpha-suffixed form (DTCG-style) via `translateColorValue`
      return typeof raw === 'object' && raw !== null && 'r' in raw ? rgbToHex(raw) : undefined;
    case 'opacity':
      return typeof raw === 'number' ? raw / 100 : undefined;
    case 'borderRadius':
    case 'sizing':
    case 'spacing':
    case 'borderWidth':
    case 'fontSize':
    case 'letterSpacing':
    case 'number':
      return typeof raw === 'number' ? raw : undefined;
    case 'fontWeight':
      return typeof raw === 'number' || typeof raw === 'string' ? raw : undefined;
    case 'fontFamily':
      // A Penpot text shape has TWO related slots: `fontFamily` (display name) and `fontId`
      // (machine id). We can only override one from here, which would create a mismatch and show
      // "Missing Font". The token's own application path drives the font on a theme switch, and
      // we leave the static value alone so the initial render keeps whatever Figma resolved
      return undefined;
    default:
      return undefined;
  }
}

export function translateTokens(data: FigmaVariablesData, mapping: MappingType): TranslatedTokens {
  const tokenSets: Record<string, TokenSet> = {};
  const tokenThemes: Record<string, TokenTheme> = {};
  const activeThemes: string[] = [];

  const usedSetPaths = new Set<string>();
  const usedTokenNames = new Set<string>();
  const variableTokenNames = new Map<string, string>(); // composite key `${variableId}/${type}` -> name
  const variableCollectionIds = new Map<string, string>();
  const variableDefaultValues = new Map<string, number | string>();
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

  for (const collection of Object.values(data.variableCollections)) {
    if (collection.remote) {
      continue;
    }

    for (const mode of collection.modes) {
      const setPath = uniqueName(`${translateTokenSetPath(collection.name)}/${translateTokenSetPath(mode.name)}`, usedSetPaths);
      const lastSlash = setPath.lastIndexOf('/');
      const themeGroup = setPath.slice(0, lastSlash);
      const themeName = setPath.slice(lastSlash + 1);

      const tokens: Record<string, Token> = {};

      for (const variableId of collection.variableIds) {
        const variable = data.variables[variableId];
        if (!variable || variable.remote) {
          continue;
        }

        const rawValue = variable.valuesByMode[mode.modeId];
        if (rawValue === undefined) {
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
          const value = translateTokenValueForType(variable, rawValue, type, data.variables, getName, mapping);
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

      tokenThemes[setPath] = {
        id: translateTokenThemeId(`${collection.id}/${mode.modeId}`, mapping),
        name: themeName,
        group: themeGroup,
        sets: [setPath],
      };

      if (mode.modeId === collection.defaultModeId) {
        activeThemes.push(setPath);
      }
    }
  }

  // Post-pass: precompute per-(variable, type) the Penpot-shape default-mode value, plus each
  // variable's collection id. Stored on the registry so transformers can rewrite a node's static
  // value (fills, corner radii, opacity, ...) to the active-theme value without re-walking Figma
  for (const collection of Object.values(data.variableCollections)) {
    if (collection.remote) {
      continue;
    }

    for (const variableId of collection.variableIds) {
      const variable = data.variables[variableId];
      if (!variable || variable.remote) {
        continue;
      }

      variableCollectionIds.set(variableId, collection.id);

      const rawDefault = resolveDefaultModeRaw(variable, data.variables, data.variableCollections);
      if (rawDefault === undefined) {
        continue;
      }

      for (const type of translateScope(variable)) {
        const shapeValue = toPenpotShapeValue(rawDefault, type, mapping);

        if (shapeValue !== undefined) {
          variableDefaultValues.set(`${variableId}/${type}`, shapeValue);
        }
      }
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
    variableCollectionIds,
    variableDefaultValues,
  };
}
