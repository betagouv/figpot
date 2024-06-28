import { TextNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformTextNode } from '@figpot/src/features/transformers/transformTextNode';
import figmaNode from '@figpot/src/fixtures/documents/text/figma.json';
import penpotNode from '@figpot/src/fixtures/documents/text/penpot.json';
import { neutralTransform } from '@figpot/src/utils/matrix';

// Due to the following error of types we make sure to cast first so TypeScript won't complain and can still check the imported JSON structure
// `Type 'number[][]' is not comparable to type '[[number, number, number], [number, number, number]]'`
type TextNodeImport = Omit<TextNode, 'relativeTransform'> & {
  relativeTransform: number[][];
};

describe('transformTextNode()', () => {
  it('should be equivalent', () => {
    const mapping: MappingType = {
      lastExport: new Date(),
      assets: new Map(),
      documents: new Map(),
      fonts: new Map(),
      nodes: new Map([['49:30', '3bfca1c9-81bc-80ba-8004-91e26d0d0c48']]),
    };

    const transformedNode = transformTextNode(figmaNode as TextNodeImport as TextNode, neutralTransform, mapping);

    expect(transformedNode).toMatchObject(penpotNode);
  });
});
