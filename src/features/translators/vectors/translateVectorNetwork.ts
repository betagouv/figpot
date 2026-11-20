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

/**
 * Builds the path of a vector network, used when Figma gives no `fillGeometry`/`strokeGeometry` for a vector (it happens for
 * some layers of instances). The segments are chained into runs (closed when they come back to their start), and the
 * positions are scaled to the node size since the network keeps the coordinates of the main component
 */
export function translateVectorNetwork(vectorNetwork: VectorNetwork, size: Point): Path {
  const positions = vectorNetwork.vertices.map((vertex) => vertex.position);
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const width = Math.max(...positions.map((position) => position.x)) - minX;
  const height = Math.max(...positions.map((position) => position.y)) - minY;
  const scaleX = width > 0 ? size.x / width : 1;
  const scaleY = height > 0 ? size.y / height : 1;

  const format = (point: Point) => `${(point.x - minX) * scaleX} ${(point.y - minY) * scaleY}`;

  const used = new Set<number>();
  const commands: string[] = [];

  for (let firstIndex = 0; firstIndex < vectorNetwork.segments.length; firstIndex++) {
    if (used.has(firstIndex)) {
      continue;
    }

    const runStart = vectorNetwork.segments[firstIndex].start;
    let current = runStart;
    let segmentIndex: number | undefined = firstIndex;

    commands.push(`M ${format(positions[runStart])}`);

    while (segmentIndex !== undefined) {
      used.add(segmentIndex);

      const segment = vectorNetwork.segments[segmentIndex];
      const forward = segment.start === current;
      const from = positions[current];
      const to = forward ? segment.end : segment.start;
      const fromTangent = (forward ? segment.startTangent : segment.endTangent) ?? { x: 0, y: 0 };
      const toTangent = (forward ? segment.endTangent : segment.startTangent) ?? { x: 0, y: 0 };

      if (fromTangent.x === 0 && fromTangent.y === 0 && toTangent.x === 0 && toTangent.y === 0) {
        commands.push(`L ${format(positions[to])}`);
      } else {
        const control1 = { x: from.x + fromTangent.x, y: from.y + fromTangent.y };
        const control2 = { x: positions[to].x + toTangent.x, y: positions[to].y + toTangent.y };

        commands.push(`C ${format(control1)} ${format(control2)} ${format(positions[to])}`);
      }

      current = to;

      if (current === runStart) {
        commands.push('Z');
        break;
      }

      // Continue with an unused segment touching the reached vertex
      const next = vectorNetwork.segments.findIndex((candidate, index) => !used.has(index) && (candidate.start === current || candidate.end === current));
      segmentIndex = next === -1 ? undefined : next;
    }
  }

  return { path: commands.join(' '), windingRule: 'NONZERO' };
}
