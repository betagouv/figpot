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
import { nullId, translateDocumentId, translateTypographyId } from '@figpot/src/features/translators/translateId';
import { TextNode as PenpotTextNode, TextStyle } from '@figpot/src/models/entities/penpot/shapes/text';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateTextSegments(registry: BoundVariableRegistry, node: TextNode, segments: TextSegment[]): PenpotTextNode[] {
  return segments.map((segment) => translateStyleTextSegment(registry, node, segment));
}

// Penpot includes the last character's trailing letter-spacing when it measures a line, which offsets
// centered and right-aligned text (Figma adds no such gap after the last glyph). Dropping it from the very
// last segment leaves every real inter-character gap untouched, so negative tracking still overlaps glyphs.
export function dropTrailingLetterSpacing(segments: PenpotTextNode[]): PenpotTextNode[] {
  if (segments.length === 0) {
    return segments;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment.letterSpacing === undefined || parseFloat(lastSegment.letterSpacing) === 0) {
    return segments;
  }

  // Spread to iterate by code point so a trailing surrogate pair (emoji, PUA glyph) is not split in half
  const characters = [...(lastSegment.text ?? '')];
  if (characters.length <= 1) {
    return [...segments.slice(0, -1), { ...lastSegment, letterSpacing: '0' }];
  }

  return [
    ...segments.slice(0, -1),
    { ...lastSegment, text: characters.slice(0, -1).join('') },
    { ...lastSegment, text: characters[characters.length - 1], letterSpacing: '0' },
  ];
}

export function transformTextStyle(registry: BoundVariableRegistry, node: TextNode, style: TypeStyle): TextStyle {
  const typographyStyleId = getTypographyStyleId(node);

  if (!typographyStyleId) {
    return partialTransformTextStyle(registry, style);
  }

  const binding = registry.resolveStyle(typographyStyleId);

  // Binding with file ID being unknown is making the font section in the UI empty and buggy,
  // for example clicking "edit library style" is crashing the whole... so better avoid the link (unlike for components)
  if (binding && binding.file === undefined) {
    return partialTransformTextStyle(registry, style);
  }

  let typographyRefId: string;
  let typographyRefFile: string;

  if (binding) {
    typographyRefId = binding.id;
    typographyRefFile = binding.file as string;
  } else {
    typographyRefId = translateTypographyId(typographyStyleId, registry.getMapping());
    typographyRefFile = translateDocumentId('current', registry.getMapping());
  }

  return {
    ...partialTransformTextStyle(registry, style),
    typographyRefId,
    typographyRefFile,
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
