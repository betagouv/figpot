import { TypePropertiesTrait } from '@figpot/src/clients/figma';
import { ListTypeFactory } from '@figpot/src/features/translators/text/paragraph/ListTypeFactory';
import { TextNode as PenpotTextNode } from '@figpot/src/models/entities/penpot/shapes/text';

type LineType = TypePropertiesTrait['lineTypes'][0];

type Level = {
  counter: number;
  type: LineType;
};

// Penpot has no list feature, so like the Penpot Figma plugin the list symbol is emulated with a text node (using the
// paragraph style) at the beginning of each list paragraph, with tabs for nested levels. The Figma REST API gives the list
// type and the indentation per line (each line being a paragraph separated by `\n`)
export class List {
  private levels: Map<number, Level> = new Map();
  private indentation = 0;
  private listTypeFactory = new ListTypeFactory();

  // Must be called for every paragraph in order, so counters are right
  public getSymbolNode(firstTextNode: PenpotTextNode, lineType: LineType | undefined, indentation: number | undefined): PenpotTextNode | null {
    const type: LineType = lineType ?? 'NONE';
    const currentIndentation = indentation ?? 0;

    if (currentIndentation < this.indentation) {
      for (let i = currentIndentation + 1; i <= this.indentation; i++) {
        this.levels.delete(i);
      }
    }

    let level = this.levels.get(currentIndentation);

    if (!level || level.type !== type) {
      level = { counter: 0, type: type };
      this.levels.set(currentIndentation, level);
    }

    level.counter++;
    this.indentation = currentIndentation;

    if (type === 'NONE') {
      return null;
    }

    const symbol = this.listTypeFactory.getListType(type).getCurrentSymbol(level.counter, currentIndentation);

    return {
      ...firstTextNode,
      text: `${'\t'.repeat(Math.max(0, currentIndentation - 1))}${symbol}`,
    };
  }
}
