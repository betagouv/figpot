import assert from 'assert';

import { MinimalFillsTrait, TextNode, TypeStyle } from '@figpot/src/clients/figma';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { translateFontName } from '@figpot/src/features/translators/text/font/translateFontName';
import { TextSegment } from '@figpot/src/features/translators/text/paragraph/translateParagraphProperties';
import { translateFontStyle } from '@figpot/src/features/translators/text/properties/translateFontStyle';
import { translateHorizontalAlign } from '@figpot/src/features/translators/text/properties/translateHorizontalAlign';
import { translateLetterSpacing } from '@figpot/src/features/translators/text/properties/translateLetterSpacing';
import { translateLineHeight } from '@figpot/src/features/translators/text/properties/translateLineHeight';
import { translateTextDecoration } from '@figpot/src/features/translators/text/properties/translateTextDecoration';
import { translateTextTransform } from '@figpot/src/features/translators/text/properties/translateTextTransform';
import { translateDocumentId, translateTypographyId } from '@figpot/src/features/translators/translateId';
import { TextNode as PenpotTextNode, TextStyle } from '@figpot/src/models/entities/penpot/shapes/text';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

export function translateTextSegments(registry: BoundVariableRegistry, node: TextNode, segments: TextSegment[]): PenpotTextNode[] {
  return segments.map((segment) => translateStyleTextSegment(registry, node, segment));
}

export function transformTextStyle(registry: BoundVariableRegistry, node: TextNode, style: TypeStyle): TextStyle {
  const typographyStyleId = getTypographyStyleId(node);

  return {
    ...partialTransformTextStyle(registry, style),
    ...(typographyStyleId
      ? {
          typographyRefId: translateTypographyId(typographyStyleId, registry.getMapping()),
          typographyRefFile: translateDocumentId('current', registry.getMapping()),
        }
      : {}),
  };
}

export function partialTransformTextStyle(registry: BoundVariableRegistry, fontName: TypeStyle): TextStyle {
  return {
    ...translateFontName(registry, fontName),
    fontFamily: fontName.fontFamily,
    fontSize: fontName.fontSize?.toString(),
    fontStyle: translateFontStyle(fontName),
    textDecoration: translateTextDecoration(fontName),
    letterSpacing: translateLetterSpacing(fontName),
    lineHeight: translateLineHeight(fontName),
    textTransform: translateTextTransform(fontName),
    textAlign: translateHorizontalAlign(fontName.textAlignHorizontal),
  };
}

function translateStyleTextSegment(registry: BoundVariableRegistry, node: TextNode, segment: TextSegment): PenpotTextNode {
  assert(segment.style.fills);

  return {
    text: segment.characters,
    ...transformTextStyle(registry, node, segment.style),
    ...transformFills(registry, segment.style as MinimalFillsTrait), // TypeScript was not detecting the check made on `.fills`
  };
}

function getTypographyStyleId(node: TextNode): string | null {
  return node.styles !== undefined ? node.styles['text'] : null;
}
