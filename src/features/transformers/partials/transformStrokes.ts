import { Command } from 'svg-path-parser';

import { HasGeometryTrait, IndividualStrokesTrait, VectorNode } from '@figpot/src/clients/figma';
import { translateStrokeCap, translateStrokes } from '@figpot/src/features/translators/translateStrokes';
import { ShapeAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Stroke } from '@figpot/src/models/entities/penpot/traits/stroke';

function hasFillGeometry(node: HasGeometryTrait): boolean {
  return !!node.fillGeometry && node.fillGeometry.length > 0;
}

export function transformStrokes(node: HasGeometryTrait | (HasGeometryTrait & IndividualStrokesTrait)): Pick<ShapeAttributes, 'strokes'> {
  const vectorNetwork = node.strokeGeometry;

  const strokeCaps = (stroke: Stroke) => {
    // TODO: don't know what to do with that, there is no distinction from Figma except into "COMPONENT" nodes (leaving commented for now)
    // if (!hasFillGeometry(node) && vectorNetwork && vectorNetwork.vertices.length > 0) {
    //   stroke.strokeCapStart = translateStrokeCap(vectorNetwork.vertices[0]);
    //   stroke.strokeCapEnd = translateStrokeCap(vectorNetwork.vertices[vectorNetwork.vertices.length - 1]);
    // }

    return stroke;
  };

  return {
    strokes: translateStrokes(node, strokeCaps),
  };
}

// function findVertex(vertexs: readonly VectorVertex[], command: Command): VectorVertex | undefined {
//   if (command.command !== 'moveto' && command.command !== 'lineto' && command.command !== 'curveto') {
//     return;
//   }

//   return vertexs.find((vertex) => vertex.x === command.x && vertex.y === command.y);
// }

export function transformStrokesFromVector(node: VectorNode, vector: Command[]): Pick<ShapeAttributes, 'strokes'> {
  const strokeCaps = (stroke: Stroke) => {
    // if (vectorRegion !== undefined) {
    //   return stroke;
    // }

    // const startVertex = findVertex(node.vectorNetwork.vertices, vector[0]);
    // const endVertex = findVertex(node.vectorNetwork.vertices, vector[vector.length - 1]);

    // if (!startVertex || !endVertex) {
    //   return stroke;
    // }

    // stroke.strokeCapStart = translateStrokeCap(startVertex);
    // stroke.strokeCapEnd = translateStrokeCap(endVertex);

    return stroke;
  };

  return {
    strokes: translateStrokes(node, strokeCaps),
  };
}
