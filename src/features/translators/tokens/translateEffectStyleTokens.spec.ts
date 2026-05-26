import { Effect } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { FigmaDefinedEffectStyle } from '@figpot/src/features/figma';
import { translateEffectStyleTokens } from '@figpot/src/features/translators/tokens/translateEffectStyleTokens';

function makeMapping(): MappingType {
  return {
    lastExport: null,
    fonts: new Map(),
    assets: new Map(),
    nodes: new Map(),
    documents: new Map(),
    colors: new Map(),
    typographies: new Map(),
    components: new Map(),
    tokenSets: new Map(),
    tokens: new Map(),
    tokenThemes: new Map(),
  };
}

describe('translateEffectStyleTokens()', () => {
  it('translates a drop shadow effect style into a shadow token', () => {
    const effectStyles: FigmaDefinedEffectStyle[] = [
      {
        id: 'S:1',
        key: 'k',
        name: 'Elevation/Card',
        description: '',
        effects: [
          { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 }, radius: 8, spread: 0, visible: true, blendMode: 'NORMAL' },
        ] as unknown as Effect[],
      },
    ];

    const result = translateEffectStyleTokens(effectStyles, makeMapping(), new Set(), new Set());

    expect(result?.tokenSet.name).toBe('FigmaStyles');
    expect(result?.tokenSet.tokens['Elevation.Card']).toMatchObject({
      type: 'shadow',
      value: [{ color: '#00000040', x: '0', y: '2', blur: '8', spread: '0', inset: false }],
    });
    expect(result?.tokenTheme).toMatchObject({ name: 'FigmaStyles', group: '', sets: ['FigmaStyles'] });
  });

  it('returns undefined when there is no effect style', () => {
    expect(translateEffectStyleTokens([], makeMapping(), new Set(), new Set())).toBeUndefined();
  });

  it('marks inner shadows as inset and skips blur effects', () => {
    const effectStyles: FigmaDefinedEffectStyle[] = [
      {
        id: 'S:2',
        key: 'k',
        name: 'Inset',
        description: '',
        effects: [
          { type: 'INNER_SHADOW', color: { r: 1, g: 0, b: 0, a: 1 }, offset: { x: 1, y: 1 }, radius: 4, spread: 2, visible: true, blendMode: 'NORMAL' },
          { type: 'LAYER_BLUR', radius: 10, visible: true },
        ] as unknown as Effect[],
      },
    ];

    const result = translateEffectStyleTokens(effectStyles, makeMapping(), new Set(), new Set());

    expect(result?.tokenSet.tokens['Inset'].value).toEqual([{ color: '#ff0000', x: '1', y: '1', blur: '4', spread: '2', inset: true }]);
  });
});
