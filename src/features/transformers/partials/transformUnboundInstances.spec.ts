import { transformUnboundInstances } from '@figpot/src/features/transformers/partials/transformUnboundInstances';
import { nullId } from '@figpot/src/features/translators/translateId';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';

describe('transformUnboundInstances()', () => {
  it('should make plain shapes of an unbound instance and all its descendants, nested instances included', () => {
    const page = {
      id: 'page',
      name: 'Page',
      objects: {
        root: { id: 'root', type: 'frame', shapes: ['unbound'] },
        unbound: {
          id: 'unbound',
          type: 'frame',
          componentId: nullId,
          componentFile: nullId,
          shapeRef: nullId,
          componentRoot: true,
          shapes: ['child', 'nested'],
        },
        child: { id: 'child', type: 'path', shapeRef: 'library-shape', touched: ['geometry-group'] },
        nested: { id: 'nested', type: 'frame', componentId: 'component', componentFile: 'file', shapeRef: 'main-shape', shapes: ['nestedChild'] },
        nestedChild: { id: 'nestedChild', type: 'path', shapeRef: 'main-shape-child' },
      },
    } as unknown as PenpotPage;

    transformUnboundInstances(page);

    expect(page.objects['unbound']).toEqual({ id: 'unbound', type: 'frame', shapes: ['child', 'nested'] });
    expect(page.objects['child']).toEqual({ id: 'child', type: 'path' });
    expect(page.objects['nested']).toEqual({ id: 'nested', type: 'frame', shapes: ['nestedChild'] });
    expect(page.objects['nestedChild']).toEqual({ id: 'nestedChild', type: 'path' });
    expect(page.objects['root']).toEqual({ id: 'root', type: 'frame', shapes: ['unbound'] });
  });
});
