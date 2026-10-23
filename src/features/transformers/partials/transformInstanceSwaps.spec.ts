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

  it('should detect a swap inside a copy of a library component thanks to the copies of the library mains', () => {
    // Instance "3:1" of the library component "L" whose main contains the copy "10:2" of component "A", swapped here for "B"
    // Note: "10:2" also exists in this document with another component, it must not be used since IDs are scoped to files
    const libraryDocument = {
      id: '0:0',
      type: 'DOCUMENT',
      children: [
        { id: '10:2', type: 'INSTANCE', componentId: 'B', children: [] },
        { id: '3:1', type: 'INSTANCE', componentId: 'L', children: [{ id: 'I3:1;10:2', type: 'INSTANCE', componentId: 'B', children: [] }] },
      ],
    } as unknown as SubcanvasNode;
    const libraryComponents = { ...components, L: { key: 'key-library', remote: true } } as unknown as Record<string, Component>;

    initializeInstanceSwaps(
      libraryDocument,
      libraryComponents,
      new Map([['key-library', 'libraryFile']]),
      new Map([['libraryFile', { '10:2': 'key-a' }]])
    );
    expect(registerInstanceSwap({ id: 'I3:1;10:2', componentId: 'B' } as InstanceNode)).toBe(deterministicUuid('10:2'));

    // Without the copies of the library mains the swap cannot be detected
    initializeInstanceSwaps(libraryDocument, libraryComponents, new Map([['key-library', 'libraryFile']]));
    expect(registerInstanceSwap({ id: 'I3:1;10:2', componentId: 'B' } as InstanceNode)).toBeUndefined();

    // Nor when the library cannot be resolved, even if this document has a node with the same ID
    initializeInstanceSwaps(libraryDocument, { ...components, L: { key: 'key-library', remote: true } } as unknown as Record<string, Component>);
    expect(registerInstanceSwap({ id: 'I3:1;10:2', componentId: 'A' } as InstanceNode)).toBeUndefined();
  });

  it('should refer to the node of the near main, prefixed when it is inside a nested instance', () => {
    expect(getNearMainNodeId('1:2')).toBe('1:2');
    expect(getNearMainNodeId('1:2;5:1')).toBe('I1:2;5:1');
  });
});
