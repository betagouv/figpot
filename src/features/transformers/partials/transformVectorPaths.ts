import svgPathParser from 'svg-path-parser';

import { Paint, PaintOverride, Path, Transform, VectorNode } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformVectorFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokesFromVector } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { translateWindingRule } from '@figpot/src/features/translators/vectors/translateWindingRule';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const { parseSVG } = svgPathParser;

function normalizePath(path: string): string {
  // Round to 2 decimal places all numbers
  const str = path.replace(/(\d+\.\d+|\d+)/g, (match: string) => {
    return parseFloat(match).toFixed(2);
  });

  // remove spaces
  return str.replace(/\s/g, '');
}

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
  shapeFills: Paint[] | null
): PathShape {
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
    ...transformVectorFills(registry, node, vectorPath, shapeFills),
    ...transformStrokesFromVector(registry, node, normalizedPaths),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformLayoutAttributes(node),
  };
}

export function transformVectorPaths(registry: AbstractRegistry, node: VectorNode, figmaNodeTransform: Transform): PathShape[] {
  assert(node.strokeGeometry);
  assert(node.fillGeometry);

  const pathShapes: PathShape[] = [];
  for (const path of node.strokeGeometry) {
    const shapeFills = getMergedFill(node, path);

    pathShapes.push(transformVectorPath(registry, node, figmaNodeTransform, path, shapeFills));
  }

  // TODO: not sure it's necessary except if the fill is not working, commenting for now
  // but for some random shapes the fill would not work and this would be required. Better to fix the curves deduplication due to the SVG parser library
  // const geometryShapes: PathShape[] = [];
  const geometryShapes = node.fillGeometry
    .filter((geometry) => !node.strokeGeometry?.find((vectorPath) => normalizePath(vectorPath.path) === normalizePath(geometry.path)))
    .map((geometry) => {
      const shapeFills = getMergedFill(node, geometry);

      return transformVectorPath(registry, node, figmaNodeTransform, geometry, shapeFills);
    });

  return [...geometryShapes, ...pathShapes];
}
