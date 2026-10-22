import { PathContent, VECTOR_CURVE_TO, VECTOR_LINE_TO, VECTOR_MOVE_TO } from '@figpot/src/models/entities/penpot/shapes/path';

export type Bounds = { x: number; y: number; width: number; height: number };

// Values of `t` in ]0, 1[ where a cubic Bézier coordinate reaches an extremum
function getCubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots: number[] = [];

  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) {
      roots.push(-c / b);
    }
  } else {
    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant);
      roots.push((-b + sqrt) / (2 * a), (-b - sqrt) / (2 * a));
    }
  }

  return roots.filter((t) => t > 0 && t < 1);
}

function getCubicValue(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;

  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

// Exact bounding box of the drawn content (curves included), like Penpot computes the selection rectangle of a path
export function getPathContentBounds(content: PathContent): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let previous: { x: number; y: number } | null = null;

  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const segment of content) {
    if (segment.command === 'move-to' || segment.command === VECTOR_MOVE_TO || segment.command === 'line-to' || segment.command === VECTOR_LINE_TO) {
      include(segment.params.x, segment.params.y);
      previous = segment.params;
    } else if ((segment.command === 'curve-to' || segment.command === VECTOR_CURVE_TO) && previous) {
      const { c1x, c1y, c2x, c2y, x, y } = segment.params;

      include(x, y);

      for (const t of getCubicExtrema(previous.x, c1x, c2x, x)) {
        include(getCubicValue(previous.x, c1x, c2x, x, t), getCubicValue(previous.y, c1y, c2y, y, t));
      }

      for (const t of getCubicExtrema(previous.y, c1y, c2y, y)) {
        include(getCubicValue(previous.x, c1x, c2x, x, t), getCubicValue(previous.y, c1y, c2y, y, t));
      }

      previous = segment.params;
    }
  }

  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
