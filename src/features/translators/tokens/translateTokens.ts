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

export function translateTokens(data: FigmaVariablesData, mapping: MappingType): TranslatedTokens {
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

      // Intentionally NOT auto-activating the Figma default mode as a Penpot theme on sync.
      // Penpot's theme model is document-wide while Figma's per-frame `explicitVariableModes` can
      // pick a different mode per frame. If we force a default theme on, the runtime applies its
      // bound values to every node and frames that depended on a per-frame override visually drift
      // from what Figma showed. With no theme active, Penpot displays whatever Figma rendered on
      // sync (faithful), and the user can manually toggle a theme to preview a global state
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
  };
}
