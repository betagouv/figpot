import { List } from '@figpot/src/features/translators/text/paragraph/List';
import { TextNode as PenpotTextNode } from '@figpot/src/models/entities/penpot/shapes/text';

const textNode = { text: 'Item', fontSize: '16' } as PenpotTextNode;

describe('List', () => {
  it('should emulate bullets with the style of the paragraph', () => {
    const list = new List();

    expect(list.getSymbolNode(textNode, 'UNORDERED', 1)).toEqual({ text: ' •  ', fontSize: '16' });
    expect(list.getSymbolNode(textNode, 'NONE', 0)).toBeNull();
    expect(list.getSymbolNode(textNode, undefined, undefined)).toBeNull();
  });

  it('should number ordered lists per level, and restart once interrupted by another kind of paragraph', () => {
    const list = new List();

    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('1. ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('2. ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 2)?.text).toBe('\ta. ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 2)?.text).toBe('\tb. ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('3. ');
    expect(list.getSymbolNode(textNode, 'NONE', 0)).toBeNull();
    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('1. ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('2. ');
    expect(list.getSymbolNode(textNode, 'UNORDERED', 1)?.text).toBe(' •  ');
    expect(list.getSymbolNode(textNode, 'ORDERED', 1)?.text).toBe('1. ');
  });
});
