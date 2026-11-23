import svgPathParser from 'svg-path-parser';

import { Paint, PaintOverride, Path, Transform, VectorNode } from '@figpot/src/clients/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills, transformVectorFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateStrokeCap } from '@figpot/src/features/translators/translateStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { translateEvenOddToNonZero } from '@figpot/src/features/translators/vectors/translateEvenOddToNonZero';
import {
  VectorNetwork,
  hasVectorNetwork,
  isStrokablePath,
  translateVectorNetwork,
} from '@figpot/src/features/translators/vectors/translateVectorNetwork';
import { translateWindingRule } from '@figpot/src/features/translators/vectors/translateWindingRule';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

const { parseSVG } = svgPathParser;

// Set by `transformBooleanNode()` on the nodes inside a boolean operation
export type BooleanOperand = { insideBooleanOperation?: boolean };

function hasBoundStrokeWeight(node: VectorNode): boolean {
  const boundVariables = (node.boundVariables ?? {}) as Record<string, unknown>;

  return boundVariables['strokeWeight'] !== undefined || boundVariables['individualStrokeWeights'] !== undefined;
}

/**
 * An outline whose weight follows a variable (an icon whose strokes thicken with a font weight theme) needs a real Penpot
 * stroke for the token to change it, so its center line is rebuilt from the vector network to be stroked natively. It is
 * not possible for:
 * - inside or outside strokes, they would need the closed outline Figma does not give here
 * - masks and boolean operands, their outline is the area they cut (Penpot ignores the strokes of boolean operands)
 * - rounded corners, Penpot strokes cannot round the corners of a path
 * - lone vertices, styles per vertex and shapes smaller than their stroke (see `isStrokablePath()`)
 *
 * Note: for debugging, `FIGPOT_NATIVE_BOUND_STROKES=false` keeps the exact outlines from `strokeGeometry` instead
 */
function canStrokeNatively(node: VectorNode): node is VectorNode & { vectorNetwork: VectorNetwork } {
  return (
    process.env.FIGPOT_NATIVE_BOUND_STROKES !== 'false' &&
    hasBoundStrokeWeight(node) &&
    (node.strokes ?? []).some((paint) => paint.visible !== false) &&
    (node.strokeAlign ?? 'CENTER') === 'CENTER' &&
    !node.isMask &&
    !(node as BooleanOperand).insideBooleanOperation &&
    !((node as { cornerRadius?: number }).cornerRadius ?? 0) &&
    hasVectorNetwork(node) &&
    isStrokablePath(node.vectorNetwork, node.strokeWeight ?? 0)
  );
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
  fills: Pick<ShapeAttributes, 'fills'>,
  strokes?: Pick<ShapeAttributes, 'strokes'>
): Omit<PathShape, 'id'> {
  // TODO: this returns a line from Figma as a rectangle, which is too complicated to move into Penpot (we should use stroke weight and stroke align to try simplifying the path)
  // Ref: https://github.com/penpot/penpot-exporter-figma-plugin/issues/210
  const normalizedPaths = parseSVG(vectorPath.path);
  const content = translateCommands(node, figmaNodeTransform, normalizedPaths);

  return {
    type: 'path',
    name: 'svg-path',
    // The fill rule is kept as information, but Penpot may not apply it (see `translateEvenOddToNonZero`)
    content: vectorPath.windingRule === 'EVENODD' ? translateEvenOddToNonZero(content) : content,
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

  // Without any geometry from Figma (it happens for some layers of instances) the vector would end as an empty group, which
  // hides everything when used as a mask and breaks Penpot group computations, so the path is rebuilt from the vector network
  // and Penpot draws the fills and strokes natively
  if (node.strokeGeometry.length === 0 && hasVectorNetwork(node)) {
    const networkPath = translateVectorNetwork(node.vectorNetwork, node.size ?? { x: 0, y: 0 });

    return [
      transformVectorPath(
        registry,
        node,
        figmaNodeTransform,
        networkPath,
        transformVectorFills(registry, node, networkPath, getMergedFill(node, networkPath)),
        transformStrokes(registry, node)
      ),
    ];
  }

  if (canStrokeNatively(node)) {
    const networkPath = translateVectorNetwork(node.vectorNetwork, node.size ?? { x: 0, y: 0 }, 'curves');
    const cap = translateStrokeCap(node);
    // Only the caps Penpot draws at both ends of an open path like Figma does
    const strokes = transformStrokes(registry, node).strokes?.map((stroke, index) =>
      index === 0 && (cap === 'round' || cap === 'square') ? { ...stroke, strokeCapStart: cap, strokeCapEnd: cap } : stroke
    );

    return [transformVectorPath(registry, node, figmaNodeTransform, networkPath, { fills: [] }, { strokes: strokes })];
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
