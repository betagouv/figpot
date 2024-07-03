import assert from 'assert';

import { MinimalFillsTrait, TextNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { translateFontName } from '@figpot/src/features/translators/text/font/translateFontName';
import { TextSegment } from '@figpot/src/features/translators/text/paragraph/translateParagraphProperties';
import { translateFontStyle } from '@figpot/src/features/translators/text/properties/translateFontStyle';
import { translateHorizontalAlign } from '@figpot/src/features/translators/text/properties/translateHorizontalAlign';
import { translateLetterSpacing } from '@figpot/src/features/translators/text/properties/translateLetterSpacing';
import { translateLineHeight } from '@figpot/src/features/translators/text/properties/translateLineHeight';
import { translateTextDecoration } from '@figpot/src/features/translators/text/properties/translateTextDecoration';
import { translateTextTransform } from '@figpot/src/features/translators/text/properties/translateTextTransform';
import { TextNode as PenpotTextNode, TextStyle } from '@figpot/src/models/entities/penpot/shapes/text';

export function translateTextSegments(node: TextNode, segments: TextSegment[], mapping: MappingType): PenpotTextNode[] {
  return segments.map((segment) => translateStyleTextSegment(node, segment, mapping));
}

export function transformTextStyle(node: TextNode, segment: TextSegment, mapping: MappingType): TextStyle {
  assert(segment.style.fontSize);

  // TODO: verify how the Figma REST API returns style keys
  // if (hasTextStyle(segment)) {
  //   return {
  //     ...partialTransformTextStyle(node, segment),
  //     textStyleId: translateTextStyleId(segment.textStyleId),
  //   };
  // }

  return {
    ...partialTransformTextStyle(node, segment, mapping),
    fontFamily: segment.style.fontFamily,
    fontSize: segment.style.fontSize.toString(),
    fontStyle: translateFontStyle(segment.style),
    textDecoration: translateTextDecoration(segment.style),
    letterSpacing: translateLetterSpacing(segment.style),
    lineHeight: translateLineHeight(segment.style),
    textTransform: translateTextTransform(segment.style),
    typographyRefFile: null, // Here to match the backend format
    typographyRefId: null, // Here to match the backend format
  };
}

function partialTransformTextStyle(node: TextNode, segment: TextSegment, mapping: MappingType): TextStyle {
  return {
    ...translateFontName(segment.style, mapping),
    textAlign: translateHorizontalAlign(node.style.textAlignHorizontal),
  };
}

function translateStyleTextSegment(node: TextNode, segment: TextSegment, mapping: MappingType): PenpotTextNode {
  assert(segment.style.fills);

  return {
    text: segment.characters,
    ...transformTextStyle(node, segment, mapping),
    ...transformFills(segment.style as MinimalFillsTrait, mapping), // TypeScript was not detecting the check made on `.fills`
  };
}

// function hasTextStyle(segment: TextSegment): boolean {
//   return segment.textStyleId !== undefined && segment.textStyleId.length > 0;
// }

// function translateTextStyleId(textStyleId: string | undefined): string | undefined {
//   if (textStyleId === undefined) return;

//   if (!textStyles.has(textStyleId)) {
//     textStyles.set(textStyleId, undefined);
//   }

//   return textStyleId;
// }
