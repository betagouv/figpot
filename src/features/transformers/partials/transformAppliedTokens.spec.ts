import { transformAppliedTokens } from '@figpot/src/features/transformers/partials/transformAppliedTokens';
import { SubcanvasNodeWithSlot } from '@figpot/src/models/entities/figma/slot';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

// `variableTokenNames` is now keyed by `${variableId}/${tokenType}` so the same Figma variable can
// resolve to a different Penpot token name depending on which property is binding it (one variable
// may produce e.g. `age.borderRadius` and `age.sizing`)
function makeRegistry(
  variableTokenNames: Record<string, string>,
  variableDefaultValueForBinding: (id: string, tokenType: string) => number | string | undefined = () => undefined,
  variableCollectionIds: Record<string, string> = {}
): BoundVariableRegistry {
  const namesMap = new Map(Object.entries(variableTokenNames));
  const collectionsMap = new Map(Object.entries(variableCollectionIds));

  return {
    getVariableTokenNames: () => namesMap,
    getVariableDefaultValueForBinding: (id: string, tokenType: string, explicitVariableModes?: Record<string, string>) => {
      // Mirror the registry's gating: only return when the variable's collection is in the override set
      if (explicitVariableModes !== undefined) {
        const collectionId = collectionsMap.get(id);
        if (!collectionId || explicitVariableModes[collectionId] === undefined) {
          return undefined;
        }
      }
      return variableDefaultValueForBinding(id, tokenType);
    },
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
    const penpotNode: Record<string, unknown> = {};

    expect(transformAppliedTokens(registry, node, penpotNode)).toEqual({
      appliedTokens: { r1: 'radius.md', fill: 'colors.brand' },
    });
    // No `explicitVariableModes` on the node, so no static overrides written
    expect(penpotNode).toEqual({});
  });

  it('returns an empty object when no bound variable resolves to a known token', () => {
    const registry = makeRegistry({});
    const node = { boundVariables: { topLeftRadius: alias('V:unknown') } } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node, {})).toEqual({});
  });

  it('reads typography bindings from `style.boundVariables`', () => {
    const registry = makeRegistry({ 'V:fs/fontSize': 'font.size.lg' });
    const node = { type: 'TEXT', style: { boundVariables: { fontSize: alias('V:fs') } } } as unknown as SubcanvasNodeWithSlot;

    expect(transformAppliedTokens(registry, node, {})).toEqual({ appliedTokens: { fontSize: 'font.size.lg' } });
  });

  it('writes a nested override to `layoutPadding.<key>` and fills in the required siblings', () => {
    // A node whose owning collection is in `explicitVariableModes` AND has a padding variable bound
    const registry = makeRegistry(
      { 'V:pad/spacing': 'spacing.md' },
      () => 16, // the registry's precomputed default-mode value
      { 'V:pad': 'C1' }
    );
    const node = {
      boundVariables: { paddingTop: alias('V:pad') },
      explicitVariableModes: { C1: 'mode-dark' },
    } as unknown as SubcanvasNodeWithSlot;
    // Penpot's schema requires every key inside `layoutPadding`, so we need to keep the siblings
    const penpotNode: Record<string, unknown> = { layoutPadding: { p1: 4, p2: 4, p3: 4, p4: 4 } };

    transformAppliedTokens(registry, node, penpotNode);

    expect(penpotNode.layoutPadding).toEqual({ p1: 16, p2: 4, p3: 4, p4: 4 });
  });
});
