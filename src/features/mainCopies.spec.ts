import { Component, SubcanvasNode } from '@figpot/src/clients/figma';
import { buildMainCopies } from '@figpot/src/features/mainCopies';

describe('buildMainCopies()', () => {
  it('should only list the copies inside mains with their component key', () => {
    const document = {
      id: '0:0',
      type: 'DOCUMENT',
      children: [
        {
          id: '1:1',
          type: 'COMPONENT_SET',
          children: [
            {
              id: '1:2',
              type: 'COMPONENT',
              children: [{ id: '1:3', type: 'INSTANCE', componentId: 'A', children: [{ id: 'I1:3;5:1', type: 'INSTANCE', componentId: 'B' }] }],
            },
          ],
        },
        { id: '2:1', type: 'INSTANCE', componentId: '1:2', children: [] },
      ],
    } as unknown as SubcanvasNode;
    const components = { A: { key: 'key-a' } } as unknown as Record<string, Component>;

    expect(buildMainCopies(document, components)).toEqual({ '1:3': 'key-a', 'I1:3;5:1': 'B' });
  });
});
