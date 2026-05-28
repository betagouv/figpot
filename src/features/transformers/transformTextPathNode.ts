import fsSync from 'fs';
import svgPathParser from 'svg-path-parser';

import { TextPathNode, Transform } from '@figpot/src/clients/figma';
import { getFigmaTextPathSvgPath } from '@figpot/src/features/document';
import { computeTextPathContentHash } from '@figpot/src/features/figma';
import { transformBlend } from '@figpot/src/features/transformers/partials/transformBlend';
import { transformConstraints } from '@figpot/src/features/transformers/partials/transformConstraints';
import { transformDimensionAndRotationAndPosition } from '@figpot/src/features/transformers/partials/transformDimensionAndRotationAndPosition';
import { transformEffects } from '@figpot/src/features/transformers/partials/transformEffects';
import { transformFills } from '@figpot/src/features/transformers/partials/transformFills';
import { transformInheritance } from '@figpot/src/features/transformers/partials/transformInheritance';
import { transformLayoutAttributes } from '@figpot/src/features/transformers/partials/transformLayout';
import { transformProportion } from '@figpot/src/features/transformers/partials/transformProportion';
import { transformSceneNode } from '@figpot/src/features/transformers/partials/transformSceneNode';
import { transformStrokes } from '@figpot/src/features/transformers/partials/transformStrokes';
import { translateCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PathShape } from '@figpot/src/models/entities/penpot/shapes/path';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

const { parseSVG } = svgPathParser;

// Penpot has no "text on a path" shape, so during `retrieve` each TEXT_PATH is rendered by Figma as an SVG
// with the glyphs outlined, and here we rebuild it as a Penpot `path` from that cached SVG.
export function transformTextPathNode(
  registry: AbstractRegistry,
  node: TextPathNode,
  figmaNodeTransform: Transform
): Omit<PathShape, 'id'> | undefined {
  // TEXT_PATH node with a non-empty `fillGeometry` is skipped since corrupted on Figma's side: their API returns the path
  // circle instead of the outlined text — even though exporting the SVG from the Figma app itself works
  // note: we could have fallback to PNG but it would add more complexity to deal with new unexpected medias,
  if (node.fillGeometry && node.fillGeometry.length > 0) {
    console.warn(
      `skipping the text-path "${node.name}" (${node.id}): the Figma API returns its path circle instead of the outlined ` +
        `text. It is a Figma API bug even if exporting it as SVG from the Figma app works fine. Deleting and recreating this node ` +
        `in Figma may fix this`
    );

    return undefined;
  }

  const svgFilePath = getFigmaTextPathSvgPath(registry.getDataDir(), node.id, computeTextPathContentHash(node));
  if (!fsSync.existsSync(svgFilePath)) {
    throw new Error(`the SVG render of the text-path "${node.name}" (${node.id}) is missing, the retrieve step should have fetched it`);
  }

  const svgContent = fsSync.readFileSync(svgFilePath, 'utf-8');
  const pathData = [...svgContent.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]).join(' ');
  if (pathData === '') {
    console.warn(`skipping the text-path "${node.name}" (${node.id}) because its SVG render contains no path`);

    return undefined;
  }

  return {
    type: 'path',
    name: node.name,
    content: translateCommands(node, figmaNodeTransform, parseSVG(pathData)),
    ...transformFills(registry, node),
    ...transformStrokes(registry, node),
    ...transformEffects(registry, node),
    ...transformSceneNode(node),
    ...transformBlend(node),
    ...transformProportion(node),
    ...transformDimensionAndRotationAndPosition(node, figmaNodeTransform),
    ...transformLayoutAttributes(node),
    ...transformConstraints(node),
    ...transformInheritance(registry, node),
  };
}
