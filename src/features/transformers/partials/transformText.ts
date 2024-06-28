import { TextNode, TypeStyle } from '@figpot/src/clients/figma';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { TextSegment } from '@figpot/src/features/translators/text/paragraph/translateParagraphProperties';
import { translateGrowType } from '@figpot/src/features/translators/text/properties/translateGrowType';
import { translateVerticalAlign } from '@figpot/src/features/translators/text/properties/translateVerticalAlign';
import { transformTextStyle, translateTextSegments } from '@figpot/src/features/translators/text/translateTextSegments';
import { TextAttributes, TextShape } from '@figpot/src/models/entities/penpot/shapes/text';

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

  // Save the last paragraph
  paragraphs.push(currentParagraph);

  return paragraphs;
}

export function transformText(node: TextNode): TextAttributes & Pick<TextShape, 'growType'> {
  const styledParagraphs = extractTextSegments(node);

  return {
    content: {
      type: 'root',
      verticalAlign: translateVerticalAlign(node.style.textAlignVertical),
      children: styledParagraphs.length
        ? [
            {
              type: 'paragraph-set',
              children: styledParagraphs.length
                ? styledParagraphs.map((paragraph) => {
                    return {
                      type: 'paragraph',
                      children: translateTextSegments(node, paragraph),
                      ...transformTextStyle(node, paragraph[0]),
                      ...transformFills(node),
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
