import { findLibraryUsages, formatLibraryUsages } from '@figpot/src/features/libraryUsages';

const tree = {
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Tableau',
        type: 'CANVAS',
        children: [
          {
            id: '2:0',
            name: 'Cellule',
            type: 'INSTANCE',
            componentId: 'local',
            children: [
              {
                id: 'I2:0;3:0',
                name: 'Masqué',
                type: 'FRAME',
                visible: false,
                children: [{ id: 'I2:0;3:1', name: 'Description', type: 'TEXT', styles: { text: 'oldStyle' } }],
              },
              { id: 'I2:0;3:2', name: 'Message', type: 'TEXT', styles: { fill: 'newStyle' } },
            ],
          },
          { id: '4:0', name: 'Bouton', type: 'INSTANCE', componentId: 'oldComponent', children: [] },
        ],
      },
    ],
  },
  components: {
    local: { key: 'localKey', name: 'Cellule' },
    oldComponent: { key: 'oldComponentKey', name: 'Bouton ancien' },
  },
  styles: {
    oldStyle: { key: 'oldStyleKey', name: 'Texte mention' },
    newStyle: { key: 'newStyleKey', name: 'Fond' },
  },
} as unknown as Parameters<typeof findLibraryUsages>[0];

describe('findLibraryUsages()', () => {
  it('should locate references by their outermost instance and flag hidden layers', () => {
    const usages = findLibraryUsages(tree, { oldComponentKey: 'oldFile' }, { oldStyleKey: 'oldFile', newStyleKey: 'newFile' }, new Set(['oldFile']));

    expect([...usages.keys()]).toEqual(['oldFile']);
    expect(usages.get('oldFile')).toEqual([
      { page: 'Tableau', nodeId: '2:0', nodeName: 'Cellule', reference: 'style "Texte mention"', hidden: true },
      { page: 'Tableau', nodeId: '4:0', nodeName: 'Bouton', reference: 'component "Bouton ancien"', hidden: false },
    ]);
  });

  it('should not flag as hidden a reference also visible inside the same instance', () => {
    const visibleTree = structuredClone(tree);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (visibleTree.document.children[0] as any).children[0].children[1].styles.text = 'oldStyle';

    expect(findLibraryUsages(visibleTree, {}, { oldStyleKey: 'oldFile' }, new Set(['oldFile'])).get('oldFile')).toEqual([
      { page: 'Tableau', nodeId: '2:0', nodeName: 'Cellule', reference: 'style "Texte mention"', hidden: false },
    ]);
  });

  it('should format usages with Figma links and a limit', () => {
    const usages = findLibraryUsages(tree, { oldComponentKey: 'oldFile' }, { oldStyleKey: 'oldFile' }, new Set(['oldFile'])).get('oldFile') ?? [];

    expect(formatLibraryUsages('abc', usages, 1)).toBe(
      [
        '  2 location(s) on 1 page(s) using 2 style(s) or component(s), 1 only on hidden layers:',
        '  - page "Tableau", "Cellule" (on hidden layers): style "Texte mention" https://www.figma.com/design/abc/?node-id=2-0',
        '  - … and 1 more',
      ].join('\n')
    );
  });
});
