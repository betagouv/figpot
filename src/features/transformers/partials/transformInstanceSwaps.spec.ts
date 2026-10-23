import { Component, InstanceNode, SubcanvasNode } from '@figpot/src/clients/figma';
import {
  getNearMainNodeId,
  getRelatedNodeId,
  initializeInstanceSwaps,
  registerInstanceSwap,
} from '@figpot/src/features/transformers/partials/transformInstanceSwaps';
import { deterministicUuid } from '@figpot/src/utils/uuid';

describe('transformInstanceSwaps', () => {
  // Main component "1:1" contains an instance "1:2" of component "A", the page has an instance of "1:1" where the
  // nested instance is swapped for component "B"
  const document = {
    id: '0:0',
    type: 'DOCUMENT',
    children: [
      { id: '1:1', type: 'COMPONENT', children: [{ id: '1:2', type: 'INSTANCE', componentId: 'A', children: [{ id: 'I1:2;5:1', type: 'TEXT' }] }] },
      {
        id: '2:1',
        type: 'INSTANCE',
        componentId: '1:1',
        children: [
          { id: 'I2:1;1:2', type: 'INSTANCE', componentId: 'B', children: [{ id: 'I2:1;1:2;6:1', type: 'TEXT' }] },
          { id: 'I2:1;1:3', type: 'INSTANCE', componentId: 'A', children: [] },
        ],
      },
    ],
  } as unknown as SubcanvasNode;
  const components = { A: { key: 'key-a' }, B: { key: 'key-b' }, '1:1': { key: 'key-main' } } as unknown as Record<string, Component>;

  it('should detect a swapped nested instance and resolve its children from the new component', () => {
    initializeInstanceSwaps(document, components);

    expect(getRelatedNodeId('2:1')).toBeUndefined();
    expect(registerInstanceSwap({ id: 'I2:1;1:2', componentId: 'B' } as InstanceNode)).toBe(deterministicUuid('1:2'));
    // Inside the swapped instance, the path belongs to the new component
    expect(getRelatedNodeId('I2:1;1:2;6:1')).toBe('6:1');
  });

  it('should not consider as swapped an instance of the same component or with an unknown near main', () => {
    initializeInstanceSwaps(document, components);

    expect(registerInstanceSwap({ id: 'I2:1;1:3', componentId: 'A' } as InstanceNode)).toBeUndefined();
    expect(registerInstanceSwap({ id: 'I9:9;1:2', componentId: 'A' } as InstanceNode)).toBeUndefined();
    expect(getRelatedNodeId('I2:1;1:2;6:1')).toBe('1:2;6:1');
  });

  it('should refer to the node of the near main, prefixed when it is inside a nested instance', () => {
    expect(getNearMainNodeId('1:2')).toBe('1:2');
    expect(getNearMainNodeId('1:2;5:1')).toBe('I1:2;5:1');
  });
});
