import { FigmaDefinedTypography } from '@figpot/src/features/figma';
import { partialTransformTextStyle } from '@figpot/src/features/translators/text/translateTextSegments';
import { translateTypographyId } from '@figpot/src/features/translators/translateId';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { PageRegistry, Registry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateTypography(registry: Registry | PageRegistry, typography: FigmaDefinedTypography): LibraryTypography {
  // Clean each group level if any
  const pathLevels = typography.name.split('/').map((pathLevel) => pathLevel.trim());
  const name = pathLevels.pop();

  assert(typography.value);

  const penpotTextStyle = partialTransformTextStyle(registry, typography.value);

  assert(penpotTextStyle);

  // TODO: our logic was for now allowing returning partial properties for node information about its typography
  // settings... but since reusing types for a defined typography it errors on type (Penpot endpoint expects all of them)
  // In the future maybe investigate to better split types instead of this hacky condition
  assert(
    name &&
      penpotTextStyle.fontFamily !== undefined &&
      penpotTextStyle.fontId !== undefined &&
      penpotTextStyle.fontVariantId !== undefined &&
      penpotTextStyle.fontSize !== undefined &&
      penpotTextStyle.lineHeight !== undefined &&
      penpotTextStyle.fontWeight !== undefined &&
      penpotTextStyle.fontStyle !== undefined &&
      penpotTextStyle.letterSpacing !== undefined &&
      penpotTextStyle.textTransform !== undefined
  );

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
