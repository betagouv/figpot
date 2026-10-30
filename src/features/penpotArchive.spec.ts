import {
  PenpotArchiveReferences,
  collectReferences,
  formatPathContent,
  formatShapeEntry,
  formatTokensEntry,
  slugifyPenpotName,
} from '@figpot/src/features/penpotArchive';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';

describe('penpotArchive', () => {
  it('should slugify names as Penpot does to match libraries at import', () => {
    expect(slugifyPenpotName('DSFR - v1.15.0 - Fondamentaux')).toBe('dsfr-v1150-fondamentaux');
    expect(slugifyPenpotName('  Éléments & co_test ')).toBe('elements-co-test');
  });

  it('should write path commands with the SVG syntax', () => {
    expect(
      formatPathContent([
        { command: 'move-to', params: { x: 1, y: 2 } },
        { command: 'line-to', params: { x: 3.5, y: 4 } },
        { command: 'curve-to', params: { c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 } },
        { command: 'close-path' },
      ])
    ).toBe('M1,2L3.5,4C1,2,3,4,5,6Z');
  });

  it('should remove internal properties and restore the root frame identifier', () => {
    expect(
      formatShapeEntry({
        id: 'a',
        parentId: 'page_rootFrame',
        frameId: 'page_rootFrame',
        type: 'path',
        content: [{ command: 'move-to', params: { x: 0, y: 0 } }],
        _apiType: 'node',
        _pageId: 'page',
      })
    ).toEqual({
      id: 'a',
      parentId: '00000000-0000-0000-0000-000000000000',
      frameId: '00000000-0000-0000-0000-000000000000',
      type: 'path',
      content: 'M0,0',
    });
  });

  it('should nest tokens and reference the active themes by path', () => {
    const { tokens, status } = formatTokensEntry({
      pages: [],
      pagesIndex: {},
      tokenSets: {
        Light: { id: 's1', name: 'Light', tokens: { a: { id: 't1', name: 'color.primary', type: 'color', value: '#000000' } } },
      },
      tokenThemes: { Light: { id: 'th1', name: 'Light', group: 'Mode', sets: ['Light'] } },
      activeTokenThemes: ['Mode/Light'],
    } as unknown as PenpotDocument['data']);

    expect(tokens.Light).toEqual({ color: { primary: { $value: '#000000', $type: 'color', $description: '' } } });
    expect(tokens.$themes).toEqual([
      { id: 'th1', name: 'Light', group: 'Mode', description: '', isSource: false, selectedTokenSets: { Light: 'enabled' } },
    ]);
    expect(status).toEqual({ activeThemes: ['Mode/Light'], activeSets: ['Light'] });
  });

  it('should collect the medias and the files a shape or a color refers to', () => {
    const references: PenpotArchiveReferences = { medias: new Map(), files: new Set() };

    collectReferences(
      {
        id: 'a',
        componentFile: 'library',
        fills: [{ fillImage: { id: 'm1', width: 1, height: 2, mtype: 'image/png' } }, { fillColorRefFile: '00000000-0000-0000-0000-000000000000' }],
      },
      references
    );
    collectReferences({ id: 'c', image: { id: 'm2', width: 3, height: 4, mtype: 'image/jpeg' } }, references);

    expect([...references.medias.keys()]).toEqual(['m1', 'm2']);
    expect([...references.files]).toEqual(['library']);
  });
});
