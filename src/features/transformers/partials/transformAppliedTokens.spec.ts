import { transformAppliedTokens } from '@figpot/src/features/transformers/partials/transformAppliedTokens';
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

describe('transformAppliedTokens() with token contexts', () => {
  const previous = process.env.FIGPOT_TOKEN_CONTEXTS;

  beforeAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = 'true';
  });

  afterAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = previous;
  });

  // Collections `C:action` (modes primary, secondary) and `C:size` (modes medium, large), a main component `1:1` setting
  // Primary and Medium
  function makeContextRegistry(overriddenFields: string[] | null) {
    return {
      getVariableTokenNames: () => new Map(),
      getThemeIdsByCollectionMode: () =>
        new Map([
          ['C:action/primary', 'T:primary'],
          ['C:action/secondary', 'T:secondary'],
          ['C:size/medium', 'T:medium'],
          ['C:size/large', 'T:large'],
        ]),
      getTokenScopeIndex: () => ({
        explicitModesByNodeId: new Map<string, Record<string, string> | undefined>([['1:1', { 'C:action': 'primary', 'C:size': 'medium' }]]),
        themeGroupById: new Map([
          ['T:primary', 'Action'],
          ['T:secondary', 'Action'],
          ['T:medium', 'Size'],
          ['T:large', 'Size'],
        ]),
      }),
      getOverrides: () => overriddenFields,
    } as unknown as BoundVariableRegistry;
  }

  it('lists the groups an overridden instance changes compared to its main', () => {
    const node = {
      id: '2:1',
      type: 'INSTANCE',
      componentId: '1:1',
      explicitVariableModes: { 'C:action': 'secondary', 'C:size': 'medium' },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(makeContextRegistry(['explicitVariableModes']), node)).toEqual({
      tokenScope: { themes: ['T:medium', 'T:secondary'], overrides: ['Action'] },
    });
  });

  it('keeps the whole scope when the main is not in the file', () => {
    const node = {
      id: '2:1',
      type: 'INSTANCE',
      componentId: '9:9',
      explicitVariableModes: { 'C:action': 'secondary' },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(makeContextRegistry(['explicitVariableModes']), node)).toEqual({
      tokenScope: { themes: ['T:secondary'] },
    });
  });

  it('gives no overrides to a copy whose modes are not overridden', () => {
    const node = {
      id: '2:1',
      type: 'INSTANCE',
      componentId: '1:1',
      explicitVariableModes: { 'C:action': 'primary', 'C:size': 'medium' },
    } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(makeContextRegistry(null), node)).toEqual({
      tokenScope: { themes: ['T:medium', 'T:primary'] },
    });
  });
});
