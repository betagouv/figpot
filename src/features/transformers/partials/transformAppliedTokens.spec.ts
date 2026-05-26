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
