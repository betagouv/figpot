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
// The values a cubic Bézier coordinate takes at its ends and extrema
function cubicExtremes(p0: number, p1: number, p2: number, p3: number): number[] {
  const values = [p0, p3];
  // Derivative: a t² + b t + c
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);
  const roots: number[] = [];

  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) {
      roots.push(-c / b);
    }
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      roots.push((-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a));
    }
  }

  for (const t of roots) {
    if (t > 0 && t < 1) {
      const u = 1 - t;
      values.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
    }
  }

  return values;
}

// The bounds of the drawn network: curves can go past their vertices
function networkBounds(vectorNetwork: VectorNetwork): { minX: number; minY: number; width: number; height: number } {
  const positions = vectorNetwork.vertices.map((vertex) => vertex.position);
  // Only the vertices segments draw (a lone vertex is not part of the path)
  const used = [...new Set(vectorNetwork.segments.flatMap((segment) => [segment.start, segment.end]))]
    .map((index) => positions[index])
    .filter(Boolean);
  const xs = used.map((position) => position.x);
  const ys = used.map((position) => position.y);

  for (const segment of vectorNetwork.segments) {
    const from = positions[segment.start];
    const to = positions[segment.end];
    const startTangent = segment.startTangent ?? { x: 0, y: 0 };
    const endTangent = segment.endTangent ?? { x: 0, y: 0 };

    if (!from || !to || (startTangent.x === 0 && startTangent.y === 0 && endTangent.x === 0 && endTangent.y === 0)) {
      continue;
    }

    xs.push(...cubicExtremes(from.x, from.x + startTangent.x, to.x + endTangent.x, to.x));
    ys.push(...cubicExtremes(from.y, from.y + startTangent.y, to.y + endTangent.y, to.y));
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return { minX: minX, minY: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/**
 * Whether the network is fully drawn by stroking its path: no lone vertex (Figma draws it as a dot with the stroke cap)
 */
export function isStrokablePath(vectorNetwork: VectorNetwork, strokeWeight = 0): boolean {
  const used = new Set(vectorNetwork.segments.flatMap((segment) => [segment.start, segment.end]));
  if (!vectorNetwork.vertices.every((_, index) => used.has(index))) {
    return false;
  }

  // A vertex or segment with its own style (a `meta` index into a table the REST API omits: rounded corner, cap...)
  const withMeta = (item: object) => !!(item as { meta?: number }).meta;
  if (vectorNetwork.vertices.some(withMeta) || vectorNetwork.segments.some(withMeta)) {
    return false;
  }

  // A shape smaller than its stroke (a dot drawn as a tiny closed path) is filled by the stroke in Figma, a ring in Penpot
  const { width, height } = networkBounds(vectorNetwork);

  return Math.max(width, height) > 2 * strokeWeight;
}

// The bounds of the vertices only, as Figma sizes the layers of an instance whose network comes from its main component
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

/**
 * `curveBounds` scales from the drawn bounds of the network (curves included) instead of its vertices
 */
export function translateVectorNetwork(vectorNetwork: VectorNetwork, size: Point, curveBounds = false): Path {
  const positions = vectorNetwork.vertices.map((vertex) => vertex.position);
  const { minX, minY, width, height } = curveBounds ? networkBounds(vectorNetwork) : vertexBounds(vectorNetwork);
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
      const next = vectorNetwork.segments.findIndex(
        (candidate, index) => !used.has(index) && (candidate.start === current || candidate.end === current)
      );
      segmentIndex = next === -1 ? undefined : next;
    }
  }

  return { path: commands.join(' '), windingRule: 'NONZERO' };
}
