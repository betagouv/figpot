import { withReferencedUnlistedVariables } from '@figpot/src/features/translators/tokens/translateTokens';

const variable = (id: string, name: string, collectionId: string, value: unknown) =>
  ({ id, name, variableCollectionId: collectionId, resolvedType: 'FLOAT', valuesByMode: { m: value }, scopes: ['WIDTH_HEIGHT'] }) as any;

describe('withReferencedUnlistedVariables()', () => {
  it('adds the unlisted variables an alias references, unless a listed one has their name', () => {
    const data = {
      variableCollections: {
        c: { id: 'c', name: 'C', modes: [{ modeId: 'm', name: 'M' }], variableIds: ['a', 'twin'] },
      } as any,
      variables: {
        a: variable('a', 'select/max', 'c', { type: 'VARIABLE_ALIAS', id: 'hidden' }),
        hidden: variable('hidden', 'button/max', 'c', 100),
        twin: variable('twin', 'regular', 'c', { type: 'VARIABLE_ALIAS', id: 'twinCopy' }),
        twinCopy: variable('twinCopy', 'regular', 'c', 400),
        unused: variable('unused', 'unused', 'c', 1),
      },
    };

    expect(withReferencedUnlistedVariables(data).variableCollections.c.variableIds).toEqual(['a', 'twin', 'hidden']);
  });
});
