import { TextNode } from '@figpot/src/clients/figma';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { List } from '@figpot/src/features/translators/text/paragraph/List';
import { TextSegment } from '@figpot/src/features/translators/text/paragraph/translateParagraphProperties';
import { translateGrowType } from '@figpot/src/features/translators/text/properties/translateGrowType';
import { translateVerticalAlign } from '@figpot/src/features/translators/text/properties/translateVerticalAlign';
import { dropTrailingLetterSpacing, transformTextStyle, translateTextSegments } from '@figpot/src/features/translators/text/translateTextSegments';
import { TextAttributes, TextShape } from '@figpot/src/models/entities/penpot/shapes/text';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

export type Paragraph = TextSegment[];

function extractTextSegments(node: TextNode): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  let previousStyleIndex: number = -1;
  let currentParagraph: Paragraph = [];
  let currentSegment: TextSegment | null = null;

  for (let i = 0; i < node.characters.length; i++) {
    // If not specified it means there is no style override
    const currentStyleIndex = node.characterStyleOverrides[i] ?? -1;

    if (!currentSegment || currentStyleIndex !== previousStyleIndex) {
      previousStyleIndex = currentStyleIndex;

      currentSegment = {
        characters: '',
        style: {
          ...node.style,
          // Add overrides for this segment
          ...(node.styleOverrideTable[currentStyleIndex]
            ? {
                ...node.styleOverrideTable[currentStyleIndex],
                // The `italic` property is not passed in overrides when it's not, we can only rely on font change to guess that
                italic:
                  node.styleOverrideTable[currentStyleIndex].fontPostScriptName !== undefined &&
                  node.styleOverrideTable[currentStyleIndex].fontPostScriptName !== node.style.fontPostScriptName &&
                  node.styleOverrideTable[currentStyleIndex].italic === undefined
                    ? false
                    : node.styleOverrideTable[currentStyleIndex].italic ?? node.style.italic,
              }
            : {}),
        },
        // TODO: scope the following ones to paragraph or segment? Depends on Penpot
        lineTypes: [],
        lineIndentations: [],
      };

      // If there is no "fills" property from style objects, we use the default from the node
      if (!currentSegment.style.fills) {
        currentSegment.style.fills = node.fills;
      }

      currentParagraph.push(currentSegment);
    }

    if (node.characters[i] === '\n') {
      // New paragraph
      paragraphs.push(currentParagraph);

      currentParagraph = [];
      currentSegment = null;
    } else {
      // Add the character, and take into account carriage return to skip to be read by Penpot
      (currentSegment as TextSegment).characters += node.characters[i] === '\u2028' ? '\n' : node.characters[i];
    }
  }

  // Save the last paragraph if not empty (Penpot does not allow empty paragraph)
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  // Penpot requires at least one paragraph, so an empty text is represented like Penpot does when clearing a text: one
  // paragraph with an empty segment keeping the node style (needed for the typing to come)
  if (paragraphs.length === 0) {
    paragraphs.push([
      {
        characters: '',
        style: {
          ...node.style,
          fills: node.style.fills ?? node.fills,
        },
        lineTypes: [],
        lineIndentations: [],
      },
    ]);
  }

  return paragraphs;
}

export function transformText(registry: AbstractRegistry, node: TextNode): TextAttributes & Pick<TextShape, 'growType'> {
  const styledParagraphs = extractTextSegments(node);

  // The trailing letter-spacing only mis-places the glyphs when the line is not left-anchored
  const dropTrailingSpacing = node.style.textAlignHorizontal === 'CENTER' || node.style.textAlignHorizontal === 'RIGHT';
  const list = new List();

  return {
    content: {
      type: 'root',
      verticalAlign: translateVerticalAlign(node.style.textAlignVertical),
      children: styledParagraphs.length
        ? [
            {
              type: 'paragraph-set',
              children: styledParagraphs.length
                ? styledParagraphs.map((paragraph, paragraphIndex) => {
                    const segments = translateTextSegments(registry, node, paragraph);

                    // Each Figma line (paragraph) has its own list type and indentation
                    const listSymbol =
                      segments.length > 0
                        ? list.getSymbolNode(segments[0], node.lineTypes?.[paragraphIndex], node.lineIndentations?.[paragraphIndex])
                        : null;
                    if (listSymbol) {
                      segments.unshift(listSymbol);
                    }

                    return {
                      type: 'paragraph',
                      children: dropTrailingSpacing ? dropTrailingLetterSpacing(segments) : segments,
                      ...transformTextStyle(registry, node, paragraph[0].style), // A paragraph cannot be empty as stated into `extractTextSegments()` (Penpot does not allow this)
                      ...transformFills(registry, node),
                    };
                  })
                : [],
            },
          ]
        : undefined,
    },
    growType: translateGrowType(node.style),
  };
}
