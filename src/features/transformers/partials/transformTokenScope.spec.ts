import { Component, SubcanvasNode } from '@figpot/src/clients/figma';
import { initializeInstanceSwaps, releaseInstanceSwaps } from '@figpot/src/features/transformers/partials/transformInstanceSwaps';
import { transformTokenScope } from '@figpot/src/features/transformers/partials/transformTokenScope';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

describe('transformTokenScope()', () => {
  const previous = process.env.FIGPOT_TOKEN_CONTEXTS;

  beforeAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = 'true';
  });

  afterAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = previous;
    releaseInstanceSwaps();
  });

  // Collections `C:action` (modes primary, secondary) and `C:size` (modes medium, large), a main component `1:1` setting
  // primary and medium, and a library component `9:9`
  beforeEach(() => {
    const main = { id: '1:1', name: 'Button', type: 'COMPONENT', explicitVariableModes: { 'C:action': 'primary', 'C:size': 'medium' } };
    const document = { id: '0:0', type: 'DOCUMENT', children: [{ id: '0:1', type: 'CANVAS', children: [main] }] };
    const components = { '1:1': { key: 'k1' }, '9:9': { key: 'k9', remote: true } } as unknown as Record<string, Component>;

    initializeInstanceSwaps(document as unknown as SubcanvasNode, components);
  });

  function makeRegistry(overriddenFields: string[] | null) {
    return {
      getTokenContexts: () => ({
        themeIdsByCollectionMode: new Map([
          ['C:action/primary', 'T:primary'],
          ['C:action/secondary', 'T:secondary'],
          ['C:size/medium', 'T:medium'],
          ['C:size/large', 'T:large'],
        ]),
        themeGroupById: new Map([
          ['T:primary', 'Action'],
          ['T:secondary', 'Action'],
          ['T:medium', 'Size'],
          ['T:large', 'Size'],
        ]),
      }),
      getOverrides: () => overriddenFields,
    } as unknown as AbstractRegistry;
  }

  const instance = (componentId: string, explicitVariableModes: Record<string, string>) => ({
    id: '2:1',
    name: 'Button',
    type: 'INSTANCE',
    componentId: componentId,
    explicitVariableModes: explicitVariableModes,
  });

  it('lists the groups an overridden instance changes compared to its main', () => {
    const node = instance('1:1', { 'C:action': 'secondary', 'C:size': 'medium' });

    expect(transformTokenScope(makeRegistry(['explicitVariableModes']), node)).toEqual({
      tokenScope: { themes: ['T:medium', 'T:secondary'], overrides: ['Action'] },
    });
  });

  it('keeps the whole scope when the main is in a library', () => {
    const node = instance('9:9', { 'C:action': 'secondary' });

    expect(transformTokenScope(makeRegistry(['explicitVariableModes']), node)).toEqual({ tokenScope: { themes: ['T:secondary'] } });
  });

  it('gives no overrides to a copy whose modes are not overridden', () => {
    const node = instance('1:1', { 'C:action': 'primary', 'C:size': 'medium' });

    expect(transformTokenScope(makeRegistry(null), node)).toEqual({ tokenScope: { themes: ['T:medium', 'T:primary'] } });
  });

  it('leaves out the modes of unknown collections', () => {
    const node = instance('1:1', { 'C:unknown': 'm' });

    expect(transformTokenScope(makeRegistry(null), node)).toEqual({});
  });
});
