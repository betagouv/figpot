import svgPathParser from 'svg-path-parser';

import { Paint, PaintOverride, Path, Transform, VectorNode } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills, transformVectorFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { translateWindingRule } from '@figpot/src/features/translators/vectors/translateWindingRule';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const { parseSVG } = svgPathParser;

function getMergedFill(node: VectorNode, vectorPath: Path): Paint[] | null {
  if (node.fillOverrideTable && vectorPath.overrideID && node.fillOverrideTable[vectorPath.overrideID]?.fills) {
    return (node.fillOverrideTable[vectorPath.overrideID] as PaintOverride).fills as Paint[];
  } else {
    return node.fills;
  }
}

function transformVectorPath(
  registry: AbstractRegistry,
  node: VectorNode,
  figmaNodeTransform: Transform,
  vectorPath: Path,
  fills: Pick<ShapeAttributes, 'fills'>,
  strokes?: Pick<ShapeAttributes, 'strokes'>
): Omit<PathShape, 'id'> {
  // TODO: this returns a line from Figma as a rectangle, which is too complicated to move into Penpot (we should use stroke weight and stroke align to try simplifying the path)
  // Ref: https://github.com/penpot/penpot-exporter-figma-plugin/issues/210
  const normalizedPaths = parseSVG(vectorPath.path);

  return {
    type: 'path',
    name: 'svg-path',
    content: translateCommands(node, figmaNodeTransform, normalizedPaths),
    svgAttrs: {
      fillRule: translateWindingRule(vectorPath.windingRule),
    },
    constraintsH: 'scale',
    constraintsV: 'scale',
    ...fills,
    ...(strokes ?? {}),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
  };
}

export function transformVectorPaths(registry: AbstractRegistry, node: VectorNode, figmaNodeTransform: Transform): Omit<PathShape, 'id'>[] {
  assert(node.strokeGeometry);
  assert(node.fillGeometry);

  // When the vector has a real fill shape, we render `fillGeometry` and let Penpot draw the stroke natively
  // from `strokeWeight`/`strokeAlign`. We deliberately avoid Figma's `strokeGeometry` here: it bakes a wrong
  // width for non-`CENTER` stroke alignments (an `INSIDE`/`OUTSIDE` stroke comes out twice as thick, since
  // the geometry is the unclipped band Figma would otherwise mask), whereas `strokeWeight` stays reliable
  if (node.fillGeometry.length > 0) {
    const strokes = transformStrokes(registry, node);

    return node.fillGeometry.map((geometry) =>
      transformVectorPath(
        registry,
        node,
        figmaNodeTransform,
        geometry,
        transformVectorFills(registry, node, geometry, getMergedFill(node, geometry)),
        strokes
      )
    );
  }

  // A vector with no fill (an outline-only shape) only exposes `strokeGeometry`, which is the stroke already
  // expanded into a fillable outline. So we paint it with the stroke color as a plain fill (its width is
  // correct for the `CENTER`-aligned strokes such vectors usually have)
  const strokeAsFills = transformFills(registry, {
    fills: node.strokes ?? [],
    styles: node.styles?.['stroke'] ? { fill: node.styles['stroke'] } : undefined,
  });

  return node.strokeGeometry.map((vectorPath) => transformVectorPath(registry, node, figmaNodeTransform, vectorPath, strokeAsFills));
}
