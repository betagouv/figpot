import { Path } from '@figpot/src/clients/figma';

type Point = { x: number; y: number };

export type VectorNetwork = {
  vertices: { position: Point }[];
  segments: { start: number; end: number; startTangent?: Point; endTangent?: Point }[];
};

export function hasVectorNetwork(node: object): node is { vectorNetwork: VectorNetwork } {
  const vectorNetwork = (node as { vectorNetwork?: Partial<VectorNetwork> | null }).vectorNetwork;

  return !!vectorNetwork && Array.isArray(vectorNetwork.vertices) && Array.isArray(vectorNetwork.segments) && vectorNetwork.segments.length > 0;
}

// The bounds of the vertices, as Figma sizes the layers of an instance whose network comes from its main component
function vertexBounds(vectorNetwork: VectorNetwork): { minX: number; minY: number; width: number; height: number } {
  const positions = vectorNetwork.vertices.map((vertex) => vertex.position);
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));

  return {
    minX: minX,
    minY: minY,
    width: Math.max(...positions.map((position) => position.x)) - minX,
    height: Math.max(...positions.map((position) => position.y)) - minY,
  };
}

function isZero(tangent: Point): boolean {
  return tangent.x === 0 && tangent.y === 0;
}

/**
 * Builds the path of a vector network, used when Figma gives no `fillGeometry`/`strokeGeometry` for a vector (it happens for
 * some layers of instances). The segments are chained into runs (closed when they come back to their start), and the
 * positions are scaled to the node size since the network keeps the coordinates of the main component
 */
export function translateVectorNetwork(vectorNetwork: VectorNetwork, size: Point): Path {
  const { segments } = vectorNetwork;
  const positions = vectorNetwork.vertices.map((vertex) => vertex.position);
  const { minX, minY, width, height } = vertexBounds(vectorNetwork);
  const scaleX = width > 0 ? size.x / width : 1;
  const scaleY = height > 0 ? size.y / height : 1;

  const format = (point: Point) => `${(point.x - minX) * scaleX} ${(point.y - minY) * scaleY}`;

  // The segments touching each vertex (in segment order), and how many of them are not drawn yet
  const segmentsByVertex = new Map<number, number[]>();
  const freeDegree = new Map<number, number>();

  segments.forEach((segment, index) => {
    for (const vertex of new Set([segment.start, segment.end])) {
      segmentsByVertex.set(vertex, [...(segmentsByVertex.get(vertex) ?? []), index]);
      freeDegree.set(vertex, (freeDegree.get(vertex) ?? 0) + 1);
    }
  });

  const used = new Set<number>();
  const use = (index: number) => {
    used.add(index);

    for (const vertex of new Set([segments[index].start, segments[index].end])) {
      freeDegree.set(vertex, (freeDegree.get(vertex) ?? 1) - 1);
    }
  };

  const commands: string[] = [];

  while (used.size < segments.length) {
    const unused = segments.map((_, index) => index).filter((index) => !used.has(index));

    // A run starting from a free end draws a joined line through the vertices it passes, whereas a run starting in the middle
    // would split a corner into two capped ends
    let firstIndex = unused[0];
    let runStart = segments[firstIndex].start;

    for (const index of unused) {
      if (freeDegree.get(segments[index].start) === 1) {
        firstIndex = index;
        runStart = segments[index].start;
        break;
      } else if (freeDegree.get(segments[index].end) === 1) {
        firstIndex = index;
        runStart = segments[index].end;
        break;
      }
    }

    let current = runStart;
    let segmentIndex: number | undefined = firstIndex;

    commands.push(`M ${format(positions[runStart])}`);

    while (segmentIndex !== undefined) {
      use(segmentIndex);

      const segment = segments[segmentIndex];
      const forward = segment.start === current;
      const to = forward ? segment.end : segment.start;
      const fromTangent = (forward ? segment.startTangent : segment.endTangent) ?? { x: 0, y: 0 };
      const toTangent = (forward ? segment.endTangent : segment.startTangent) ?? { x: 0, y: 0 };

      if (isZero(fromTangent) && isZero(toTangent)) {
        commands.push(`L ${format(positions[to])}`);
      } else {
        const control1 = { x: positions[current].x + fromTangent.x, y: positions[current].y + fromTangent.y };
        const control2 = { x: positions[to].x + toTangent.x, y: positions[to].y + toTangent.y };

        commands.push(`C ${format(control1)} ${format(control2)} ${format(positions[to])}`);
      }

      current = to;

      if (current === runStart) {
        commands.push('Z');
        break;
      }

      // Continue with a segment not drawn yet touching the reached vertex
      segmentIndex = segmentsByVertex.get(current)?.find((index) => !used.has(index));
    }
  }

  return { path: commands.join(' '), windingRule: 'NONZERO' };
}
