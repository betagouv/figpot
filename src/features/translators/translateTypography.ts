import assert from 'assert';

import { FigmaDefinedTypography } from '@figpot/src/features/figma';
import { partialTransformTextStyle } from '@figpot/src/features/translators/text/translateTextSegments';
import { translateTypographyId } from '@figpot/src/features/translators/translateId';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { PageRegistry, Registry } from '@figpot/src/models/entities/registry';

export function translateTypography(registry: Registry | PageRegistry, typography: FigmaDefinedTypography): LibraryTypography {
  // Clean each group level if any
  const pathLevels = typography.name.split('/').map((pathLevel) => pathLevel.trim());
  const name = pathLevels.pop();

  assert(typography.value);

  const penpotTextStyle = partialTransformTextStyle(registry, typography.value);

  assert(penpotTextStyle);

  return {
    id: translateTypographyId(typography.id, registry.getMapping()),
    path: pathLevels.length > 0 ? pathLevels.join(' / ') : '', // We add spaces as normalized by Penpot
    name: name,
    fontFamily: penpotTextStyle.fontFamily,
    fontId: penpotTextStyle.fontId,
    fontVariantId: penpotTextStyle.fontVariantId,
    fontSize: penpotTextStyle.fontSize,
    lineHeight: penpotTextStyle.lineHeight,
    fontWeight: penpotTextStyle.fontWeight,
    fontStyle: penpotTextStyle.fontStyle,
    letterSpacing: penpotTextStyle.letterSpacing,
    textTransform: penpotTextStyle.textTransform,
  };
}
