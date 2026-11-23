import { LocalVariable } from '@figpot/src/clients/figma';
import { TokenType } from '@figpot/src/models/entities/penpot/traits/token';

//
// Single Figma variable can map to several Penpot types when its scope is `ALL_SCOPES` or when several scopes are declared
//

const FLOAT_ALL_SCOPES_TYPES: TokenType[] = [
  'borderRadius',
  'sizing',
  'spacing',
  'borderWidth',
  'opacity',
  'fontWeight',
  'fontSize',
  'letterSpacing',
];

const STRING_ALL_SCOPES_TYPES: TokenType[] = ['fontFamily', 'fontWeight'];

function floatScopeToType(scope: string): TokenType | undefined {
  switch (scope) {
    case 'CORNER_RADIUS':
      return 'borderRadius';
    case 'WIDTH_HEIGHT':
      return 'sizing';
    case 'GAP':
      return 'spacing';
    case 'STROKE_FLOAT':
      // Penpot's `:decode/json` converts the Tokens-Studio-style `borderWidth` to its kebab keyword
      // `:stroke-width`. Sending `strokeWidth` directly is rejected (the decoder returns nil)
      return 'borderWidth';
    case 'OPACITY':
      return 'opacity';
    case 'FONT_SIZE':
      return 'fontSize';
    case 'FONT_WEIGHT':
    case 'FONT_STYLE':
      return 'fontWeight';
    case 'LETTER_SPACING':
      return 'letterSpacing';
    default:
      return undefined;
  }
}

function stringScopeToType(scope: string): TokenType | undefined {
  switch (scope) {
    case 'FONT_FAMILY':
      return 'fontFamily';
    case 'FONT_STYLE':
    case 'FONT_WEIGHT':
      return 'fontWeight';
    default:
      return undefined;
  }
}

export function translateScope(variable: LocalVariable): TokenType[] {
  switch (variable.resolvedType) {
    case 'COLOR':
      return ['color'];
    case 'BOOLEAN':
      return ['boolean'];
    case 'STRING':
      if (variable.scopes.includes('ALL_SCOPES')) {
        return [...STRING_ALL_SCOPES_TYPES];
      } else {
        const types = new Set<TokenType>();

        for (const scope of variable.scopes) {
          const type = stringScopeToType(scope);
          if (type !== undefined) {
            types.add(type);
          }
        }

        return types.size > 0 ? [...types] : ['string'];
      }
    case 'FLOAT':
      if (variable.scopes.length === 0) {
        return ['number'];
      } else if (variable.scopes.includes('ALL_SCOPES')) {
        return [...FLOAT_ALL_SCOPES_TYPES];
      } else {
        const types = new Set<TokenType>();
        for (const scope of variable.scopes) {
          const type = floatScopeToType(scope);

          if (type !== undefined) {
            types.add(type);
          }
        }

        return types.size > 0 ? [...types] : ['number'];
      }
  }
}

// Whether the variable's declared scopes left us guessing rather than precisely matching a Penpot
// token type (the user did not narrow the scope past `ALL_SCOPES`). Used to surface a warning that
// invites the user to set explicit scopes in Figma for unambiguous mappings
export function hasInferredScope(variable: LocalVariable): boolean {
  if (variable.resolvedType !== 'STRING' && variable.resolvedType !== 'FLOAT') {
    return false;
  }

  return variable.scopes.includes('ALL_SCOPES');
}

// Whether the variable will emit several Penpot tokens (and therefore need `.typeName`-suffixed names)
export function isMultiTypeVariable(variable: LocalVariable): boolean {
  return translateScope(variable).length > 1;
}
