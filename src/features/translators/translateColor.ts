import { FigmaDefinedColor } from '@figpot/src/features/figma';
import { translateFill } from '@figpot/src/features/translators/fills/translateFills';
import { translateColorId } from '@figpot/src/features/translators/translateId';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { PageRegistry, Registry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateColor(registry: Registry | PageRegistry, color: FigmaDefinedColor): Color {
  // Clean each group level if any
  const pathLevels = color.name.split('/').map((pathLevel) => pathLevel.trim());
  const name = pathLevels.pop();

  assert(color.value);

  const penpotFill = translateFill(registry, color.value);

  assert(penpotFill);

  return {
    id: translateColorId(color.id, registry.getMapping()),
    path: pathLevels.length > 0 ? pathLevels.join(' / ') : '', // We add spaces as normalized by Penpot
    name: name ?? 'unknown color name',
    color: penpotFill.fillColor,
    opacity: penpotFill.fillOpacity,
    gradient: penpotFill.fillColorGradient,
    image: penpotFill.fillImage,
  };
}
