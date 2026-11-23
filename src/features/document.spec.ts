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
      const penpotTree = JSON.parse(JSON.stringify(emptyPenpotTree)); // Deep copy to isolate each test

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
        tokenSets: new Map(),
        tokens: new Map(),
        tokenThemes: new Map(),
      };

      const transformedTree = transformDocument(
        emptyFigmaTree as GetFileResponse,
        [],
        [],
        { variables: {}, variableCollections: {} },
        [],
        new Map(),
        new Map(),
        new Map(),
        mapping,
        '/tmp/figpot-test-data'
      );
      const cleanHostedTree = cleanHostedDocument(penpotTree);

      const differences = getDifferences(cleanHostedTree, transformedTree);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations).toEqual([]);
    });

    it('should require changes', () => {
      const penpotTree = JSON.parse(JSON.stringify(emptyPenpotTree)); // Deep copy to isolate each test

      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map(),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
        tokenSets: new Map(),
        tokens: new Map(),
        tokenThemes: new Map(),
      };

      const transformedTree = transformDocument(
        emptyFigmaTree as GetFileResponse,
        [],
        [],
        { variables: {}, variableCollections: {} },
        [],
        new Map(),
        new Map(),
        new Map(),
        mapping,
        '/tmp/figpot-test-data'
      );
      const cleanHostedTree = cleanHostedDocument(penpotTree);

      const differences = getDifferences(cleanHostedTree, transformedTree);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations.length).toBe(6);
      expect(differences.newTreeOperations.map((op) => op.type)).toEqual(['add-page', 'mod-page', 'mod-obj', 'del-page', 'del-obj', 'mov-page']);
    });
  });

  describe('with token themes', () => {
    function getEquivalentTrees() {
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
        tokenSets: new Map(),
        tokens: new Map(),
        tokenThemes: new Map(),
      };

      const transformedTree = transformDocument(
        emptyFigmaTree as GetFileResponse,
        [],
        [],
        { variables: {}, variableCollections: {} },
        [],
        new Map(),
        new Map(),
        new Map(),
        mapping,
        '/tmp/figpot-test-data'
      );
      const cleanHostedTree = cleanHostedDocument(JSON.parse(JSON.stringify(emptyPenpotTree)));

      return { cleanHostedTree, transformedTree };
    }

    const theme = (name: string, sets: string[]) => ({ id: `id-${name}`, name: name, group: 'G', sets: sets });

    it('should ignore the order of the active themes and of the sets of a theme', () => {
      const { cleanHostedTree, transformedTree } = getEquivalentTrees();

      // Penpot keeps them as sets, returned in any order
      cleanHostedTree.data.tokenThemes = { 'G/a': theme('a', ['s2', 's1']), 'G/b': theme('b', ['s3']) };
      cleanHostedTree.data.activeTokenThemes = ['G/b', 'G/a'];
      transformedTree.data.tokenThemes = { 'G/a': theme('a', ['s1', 's2']), 'G/b': theme('b', ['s3']) };
      transformedTree.data.activeTokenThemes = ['G/a', 'G/b'];

      expect(getDifferences(cleanHostedTree, transformedTree).newTreeOperations).toEqual([]);
    });

    it('should require changes when the sets differ', () => {
      const { cleanHostedTree, transformedTree } = getEquivalentTrees();

      cleanHostedTree.data.tokenThemes = { 'G/a': theme('a', ['s2', 's1']) };
      transformedTree.data.tokenThemes = { 'G/a': theme('a', ['s1', 's3']) };

      expect(getDifferences(cleanHostedTree, transformedTree).newTreeOperations.map((operation) => operation.type)).toEqual(['set-token-theme']);
    });
  });

  describe('with rectangle', () => {
    const penpotTree = JSON.parse(JSON.stringify(withRectangePenpotTree)); // Deep copy to isolate each test

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
        tokenSets: new Map(),
        tokens: new Map(),
        tokenThemes: new Map(),
      };

      const transformedTree = transformDocument(
        withRectangeFigmaTree as GetFileResponse,
        [],
        [],
        { variables: {}, variableCollections: {} },
        [],
        new Map(),
        new Map(),
        new Map(),
        mapping,
        '/tmp/figpot-test-data'
      );
      const cleanHostedTree = cleanHostedDocument(penpotTree);

      const differences = getDifferences(cleanHostedTree, transformedTree);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations).toEqual([]);
    });

    it('should require changes', () => {
      const penpotTree = JSON.parse(JSON.stringify(withRectangePenpotTree)); // Deep copy to isolate each test

      const mapping: MappingType = {
        lastExport: new Date(),
        assets: new Map(),
        documents: new Map(),
        fonts: new Map(),
        nodes: new Map(),
        colors: new Map(),
        typographies: new Map(),
        components: new Map(),
        tokenSets: new Map(),
        tokens: new Map(),
        tokenThemes: new Map(),
      };

      const transformedTree = transformDocument(
        withRectangeFigmaTree as GetFileResponse,
        [],
        [],
        { variables: {}, variableCollections: {} },
        [],
        new Map(),
        new Map(),
        new Map(),
        mapping,
        '/tmp/figpot-test-data'
      );
      const cleanHostedTree = cleanHostedDocument(penpotTree);

      const differences = getDifferences(cleanHostedTree, transformedTree);

      expect(differences.newDocumentName).toBeUndefined();
      expect(differences.newTreeOperations.length).toBe(8);
      expect(differences.newTreeOperations.map((op) => op.type)).toEqual([
        'add-page',
        'mod-page',
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
