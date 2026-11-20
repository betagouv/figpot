import { dropUnstrokedWidthTokens, transformAppliedTokens } from '@figpot/src/features/transformers/partials/transformAppliedTokens';
import { SubcanvasNodeWithSlot } from '@figpot/src/models/entities/figma/slot';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

// `variableTokenNames` is now keyed by `${variableId}/${tokenType}` so the same Figma variable can
// resolve to a different Penpot token name depending on which property is binding it (one variable
// may produce e.g. `age.borderRadius` and `age.sizing`)
function makeRegistry(variableTokenNames: Record<string, string>): BoundVariableRegistry {
  const map = new Map(Object.entries(variableTokenNames));

  return {
    getVariableTokenNames: () => map,
  } as unknown as BoundVariableRegistry;
}

function alias(id: string) {
  return { type: 'VARIABLE_ALIAS', id: id };
}

describe('transformAppliedTokens()', () => {
  it('binds shape properties from `boundVariables` and the last solid paint colour', () => {
    const registry = makeRegistry({ 'V:1/color': 'colors.brand', 'V:2/borderRadius': 'radius.md' });
    const node = {
      boundVariables: { topLeftRadius: alias('V:2') },
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, boundVariables: { color: alias('V:1') } }],
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({
      appliedTokens: { r1: 'radius.md', fill: 'colors.brand' },
    });
  });

  it('returns an empty object when no bound variable resolves to a known token', () => {
    const registry = makeRegistry({});
    const node = { boundVariables: { topLeftRadius: alias('V:unknown') } } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({});
  });

  it('reads typography bindings from `style.boundVariables`', () => {
    const registry = makeRegistry({ 'V:fs/fontSize': 'font.size.lg' });
    const node = { type: 'TEXT', style: { boundVariables: { fontSize: alias('V:fs') } } } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({ appliedTokens: { fontSize: 'font.size.lg' } });
  });
});

describe('transformAppliedTokens() bindings', () => {
  it('binds rectangle corner radii, minimum and maximum sizes, and a stroke weight for all sides', () => {
    const registry = makeRegistry({
      'V:r/borderRadius': 'radius.md',
      'V:min/sizing': 'size.min',
      'V:max/sizing': 'size.max',
      'V:stroke/borderWidth': 'border.thin',
    });
    const node = {
      boundVariables: {
        rectangleCornerRadii: {
          RECTANGLE_TOP_LEFT_CORNER_RADIUS: alias('V:r'),
          RECTANGLE_TOP_RIGHT_CORNER_RADIUS: alias('V:r'),
          RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: alias('V:r'),
          RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: alias('V:r'),
        },
        minHeight: alias('V:min'),
        maxWidth: alias('V:max'),
        strokeWeight: alias('V:stroke'),
      },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({
      appliedTokens: {
        r1: 'radius.md',
        r2: 'radius.md',
        r3: 'radius.md',
        r4: 'radius.md',
        layoutItemMinH: 'size.min',
        layoutItemMaxW: 'size.max',
        strokeWidthTop: 'border.thin',
        strokeWidthRight: 'border.thin',
        strokeWidthBottom: 'border.thin',
        strokeWidthLeft: 'border.thin',
      },
    });
  });

  it('binds the stroke weights per side as the REST API names them', () => {
    const registry = makeRegistry({ 'V:w/borderWidth': 'border.weight' });
    const node = {
      boundVariables: {
        individualStrokeWeights: {
          BORDER_TOP_WEIGHT: alias('V:w'),
          BORDER_RIGHT_WEIGHT: alias('V:w'),
          BORDER_BOTTOM_WEIGHT: alias('V:w'),
          BORDER_LEFT_WEIGHT: alias('V:w'),
        },
      },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({
      appliedTokens: {
        strokeWidthTop: 'border.weight',
        strokeWidthRight: 'border.weight',
        strokeWidthBottom: 'border.weight',
        strokeWidthLeft: 'border.weight',
      },
    });
  });

  it('binds the spacing of a flex layout to the gap along its direction, and the gaps of a grid layout', () => {
    const registry = makeRegistry({ 'V:gap/spacing': 'space.gap', 'V:row/spacing': 'space.row' });
    const flex = { layoutMode: 'VERTICAL', boundVariables: { itemSpacing: alias('V:gap') } } as unknown as SubcanvasNodeWithSlot;
    const grid = {
      layoutMode: 'GRID',
      boundVariables: { gridRowGap: alias('V:row'), gridColumnGap: alias('V:gap') },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, flex)).toEqual({ appliedTokens: { rowGap: 'space.gap' } });
    expect(transformAppliedTokens(registry, grid)).toEqual({ appliedTokens: { rowGap: 'space.row', columnGap: 'space.gap' } });
  });

  it('binds the spacing between the lines of a wrapping layout to the other gap', () => {
    const registry = makeRegistry({ 'V:gap/spacing': 'space.gap', 'V:line/spacing': 'space.line' });
    const boundVariables = { itemSpacing: alias('V:gap'), counterAxisSpacing: alias('V:line') };
    const wrapping = { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', boundVariables: boundVariables } as unknown as SubcanvasNodeWithSlot;
    const notWrapping = { layoutMode: 'HORIZONTAL', layoutWrap: 'NO_WRAP', boundVariables: boundVariables } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, wrapping)).toEqual({ appliedTokens: { rowGap: 'space.line', columnGap: 'space.gap' } });
    expect(transformAppliedTokens(registry, notWrapping)).toEqual({ appliedTokens: { columnGap: 'space.gap' } });
  });

  it('binds no line height token, Penpot would apply its pixels as a ratio of the font size', () => {
    const registry = makeRegistry({ 'V:lh/sizing': 'line.24', 'V:fs/fontSize': 'font.16' });
    const node = {
      type: 'TEXT',
      boundVariables: { lineHeight: [alias('V:lh')] },
      style: { boundVariables: { lineHeight: alias('V:lh'), fontSize: alias('V:fs') } },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({ appliedTokens: { fontSize: 'font.16' } });
  });

  it('falls back to another number token the variable gives, never to a color', () => {
    // A variable scoped to sizes only gives a `sizing` token, bound here to a radius
    const registry = makeRegistry({ 'V:size/sizing': 'size.4', 'V:c/color': 'color.brand' });
    const node = { boundVariables: { topLeftRadius: alias('V:size'), topRightRadius: alias('V:c') } } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node)).toEqual({ appliedTokens: { r1: 'size.4' } });
  });
});

describe('dropUnstrokedWidthTokens()', () => {
  const result = { appliedTokens: { strokeWidthTop: 'w', strokeWidthLeft: 'w', fill: 'c' } };

  it('drops the stroke width tokens of shapes without stroke only', () => {
    expect(dropUnstrokedWidthTokens(result, { strokes: [] })).toEqual({ appliedTokens: { fill: 'c' } });
    expect(dropUnstrokedWidthTokens(result, {})).toEqual({ appliedTokens: { fill: 'c' } });
    expect(dropUnstrokedWidthTokens(result, { strokes: [{ strokeWidth: 1 }] })).toEqual(result);
  });

  it('gives no applied tokens when only stroke width ones were there', () => {
    expect(dropUnstrokedWidthTokens({ appliedTokens: { strokeWidthTop: 'w' } }, {})).toEqual({});
  });
});
