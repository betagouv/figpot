import { GetFileResponse } from '@figpot/src/clients/figma';
import { MappingType, getDifferences, transformDocument } from '@figpot/src/features/document';
import { cleanHostedDocument } from '@figpot/src/features/penpot';
import emptyFigmaTree from '@figpot/src/fixtures/documents/empty/figma.json';
import emptyPenpotTree from '@figpot/src/fixtures/documents/empty/penpot.json';
import withRectangeFigmaTree from '@figpot/src/fixtures/documents/rectangle/figma.json';
import withRectangePenpotTree from '@figpot/src/fixtures/documents/rectangle/penpot.json';

describe('document comparaison', () => {
  describe('empty', () => {
    it('should be equivalent', () => {
      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map([
          ['0:0', '00000000-0000-0000-0000-000000000000'],
          ['0:1', '4bf0e9f6-08c8-809c-8004-85445179c2aa'],
        ]),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
      };

      const transformedTree = transformDocument(emptyFigmaTree as GetFileResponse, [], [], mapping);
      const cleanHostedTree = cleanHostedDocument(emptyPenpotTree);

      expect(transformedTree).toEqual(cleanHostedTree);

      const differences = getDifferences('no_matter', cleanHostedTree, transformedTree, []);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations).toEqual([]);
    });

    it('should require changes', () => {
      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map(),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
      };

      const transformedTree = transformDocument(emptyFigmaTree as GetFileResponse, [], [], mapping);
      const cleanHostedTree = cleanHostedDocument(emptyPenpotTree);

      expect(transformedTree).not.toEqual(cleanHostedTree);

      const differences = getDifferences('no_matter', cleanHostedTree, transformedTree, []);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations.length).toBe(6);
      expect(differences.newTreeOperations.map((op) => op.type)).toEqual(['add-page', 'set-option', 'mod-obj', 'del-page', 'del-obj', 'mov-page']);
    });
  });

  describe('with rectangle', () => {
    it('should be equivalent', () => {
      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map([
          ['0:0', '00000000-0000-0000-0000-000000000000'],
          ['0:1', '4bf0e9f6-08c8-809c-8004-85445179c2aa'],
          ['1:2', 'ddfee392-d246-80fc-8004-8664a46a5d1f'],
        ]),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
      };

      const transformedTree = transformDocument(withRectangeFigmaTree as GetFileResponse, [], [], mapping);
      const cleanHostedTree = cleanHostedDocument(withRectangePenpotTree);

      expect(transformedTree).toEqual(cleanHostedTree);

      const differences = getDifferences('no_matter', cleanHostedTree, transformedTree, []);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations).toEqual([]);
    });

    it('should require changes', () => {
      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map(),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
      };

      const transformedTree = transformDocument(withRectangeFigmaTree as GetFileResponse, [], [], mapping);
      const cleanHostedTree = cleanHostedDocument(withRectangePenpotTree);

      expect(transformedTree).not.toEqual(cleanHostedTree);

      const differences = getDifferences('no_matter', cleanHostedTree, transformedTree, []);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations.length).toBe(8);
      expect(differences.newTreeOperations.map((op) => op.type)).toEqual([
        'add-page',
        'set-option',
        'mod-obj',
        'add-obj',
        'del-page',
        'del-obj',
        'del-obj',
        'mov-page',
      ]);
    });
  });
});
