import { Effect } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { FigmaDefinedEffectStyle } from '@figpot/src/features/figma';
import { translateTokenName, translateTokenSetPath, uniqueName } from '@figpot/src/features/translators/tokens/translateTokenName';
import { translateTokenId, translateTokenSetId, translateTokenThemeId } from '@figpot/src/features/translators/translateId';
import { ShadowTokenValue, Token, TokenSet, TokenTheme } from '@figpot/src/models/entities/penpot/traits/token';
import { rgbToHex } from '@figpot/src/utils/color';

// Figma effect styles share one dedicated set/theme rather than being scattered across variable
// collections. The path is collision-suffixed against the variable-derived sets in `translateTokens`
const EFFECT_STYLES_SET_NAME = 'Figma Styles';

function translateShadow(effect: Effect): ShadowTokenValue | undefined {
  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return undefined; // blur effects have no Penpot `shadow` token equivalent
  }

  const hex = rgbToHex(effect.color);
  const color =
    effect.color.a !== undefined && effect.color.a < 1
      ? `${hex}${Math.round(effect.color.a * 255)
          .toString(16)
          .padStart(2, '0')}`
      : hex;

  return {
    color: color,
    x: String(effect.offset.x),
    y: String(effect.offset.y),
    blur: String(effect.radius),
    spread: String(effect.spread ?? 0),
    inset: effect.type === 'INNER_SHADOW',
  };
}

export function translateEffectStyleTokens(
  effectStyles: FigmaDefinedEffectStyle[],
  mapping: MappingType,
  usedSetPaths: Set<string>,
  usedTokenNames: Set<string>
): { tokenSet: TokenSet; tokenTheme: TokenTheme } | undefined {
  const tokens: Record<string, Token> = {};

  for (const effectStyle of effectStyles) {
    const shadows = effectStyle.effects.map(translateShadow).filter((shadow): shadow is ShadowTokenValue => shadow !== undefined);

    if (shadows.length === 0) {
      continue;
    }

    const name = uniqueName(translateTokenName(effectStyle.name), usedTokenNames);
    tokens[name] = {
      // We compute the token's id from its final setPath/name after the set path is resolved below
      id: '',
      name: name,
      type: 'shadow',
      value: shadows,
      description: effectStyle.description || undefined,
    };
  }

  if (Object.keys(tokens).length === 0) {
    return undefined;
  }

  const setPath = uniqueName(translateTokenSetPath(EFFECT_STYLES_SET_NAME), usedSetPaths);

  // Now that the set path is known we can derive each token's deterministic id from it
  for (const [name, token] of Object.entries(tokens)) {
    token.id = translateTokenId(setPath, name);
  }

  return {
    tokenSet: {
      id: translateTokenSetId(setPath),
      name: setPath,
      tokens: tokens,
    },
    tokenTheme: {
      id: translateTokenThemeId(`${setPath}`),
      name: setPath,
      group: '',
      sets: [setPath],
    },
  };
}
