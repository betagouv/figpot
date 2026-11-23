import {
  PathContent,
  Segment,
  VECTOR_CLOSE_PATH,
  VECTOR_CURVE_TO,
  VECTOR_LINE_TO,
  VECTOR_MOVE_TO,
} from '@figpot/src/models/entities/penpot/shapes/path';

type Point = { x: number; y: number };

type Subpath = {
  start: Point;
  segments: Exclude<Segment, { command: 'move-to' | typeof VECTOR_MOVE_TO } | { command: 'close-path' | typeof VECTOR_CLOSE_PATH }>[];
  closed: boolean;
};

const curveSamples = 8;

function isMoveTo(segment: Segment): segment is Extract<Segment, { command: 'move-to' | typeof VECTOR_MOVE_TO }> {
  return segment.command === 'move-to' || segment.command === VECTOR_MOVE_TO;
}

function isClosePath(segment: Segment): boolean {
  return segment.command === 'close-path' || segment.command === VECTOR_CLOSE_PATH;
}

function isCurveTo(segment: Segment): segment is Extract<Segment, { command: 'curve-to' | typeof VECTOR_CURVE_TO }> {
  return segment.command === 'curve-to' || segment.command === VECTOR_CURVE_TO;
}

function isLineTo(segment: Segment): segment is Extract<Segment, { command: 'line-to' | typeof VECTOR_LINE_TO }> {
  return segment.command === 'line-to' || segment.command === VECTOR_LINE_TO;
}

// Returns `null` when the content has a shape this logic does not handle (drawing after a `close-path` without `move-to`)
function splitSubpaths(content: PathContent): Subpath[] | null {
  const subpaths: Subpath[] = [];
  let current: Subpath | null = null;

  for (const segment of content) {
    if (isMoveTo(segment)) {
      current = { start: { x: segment.params.x, y: segment.params.y }, segments: [], closed: false };
      subpaths.push(current);
    } else if (!current || current.closed) {
      return null;
    } else if (isClosePath(segment)) {
      current.closed = true;
    } else {
      current.segments.push(segment as Subpath['segments'][number]);
    }
  }

  return subpaths;
}

function toPolyline(subpath: Subpath): Point[] {
  const points: Point[] = [subpath.start];
  let previous = subpath.start;

  for (const segment of subpath.segments) {
    if (isCurveTo(segment)) {
      const { c1x, c1y, c2x, c2y, x, y } = segment.params;

      for (let i = 1; i <= curveSamples; i++) {
        const t = i / curveSamples;
        const mt = 1 - t;

        points.push({
          x: mt * mt * mt * previous.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x,
          y: mt * mt * mt * previous.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y,
        });
      }
    } else if (isLineTo(segment)) {
      points.push({ x: segment.params.x, y: segment.params.y });
    }

    previous = points[points.length - 1];
  }

  return points;
}

function signedArea(polyline: Point[]): number {
  let area = 0;

  for (let i = 0; i < polyline.length; i++) {
    const current = polyline[i];
    const next = polyline[(i + 1) % polyline.length];

    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];

    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }

  return inside;
}

function reverseSubpath(subpath: Subpath): PathContent {
  const points: Point[] = [subpath.start, ...subpath.segments.map((segment) => ({ x: segment.params.x, y: segment.params.y }))];
  const reversed: PathContent = [{ command: 'move-to', params: points[points.length - 1] }];

  for (let i = subpath.segments.length - 1; i >= 0; i--) {
    const segment = subpath.segments[i];
    const end = points[i];

    if (isCurveTo(segment)) {
      reversed.push({
        command: 'curve-to',
        params: { x: end.x, y: end.y, c1x: segment.params.c2x, c1y: segment.params.c2y, c2x: segment.params.c1x, c2y: segment.params.c1y },
      });
    } else {
      reversed.push({ command: 'line-to', params: { x: end.x, y: end.y } });
    }
  }

  if (subpath.closed) {
    reversed.push({ command: 'close-path', params: null });
  }

  return reversed;
}

function serializeSubpath(subpath: Subpath): PathContent {
  return [
    { command: 'move-to', params: subpath.start },
    ...subpath.segments,
    ...(subpath.closed ? [{ command: 'close-path', params: null } as Segment] : []),
  ];
}

// Since Penpot v2.16 the renderer only reads `svgAttrs.fillRule`, whereas its JSON API (and the `.penpot` import) stores
// it as `fill-rule`, so "evenodd" is ignored and holes get filled. To render the same with the default "nonzero" rule,
// subpaths are oriented alternately according to their nesting depth (it works for non-intersecting subpaths, which is
// the case of icons and pictograms)
export function translateEvenOddToNonZero(content: PathContent): PathContent {
  const subpaths = splitSubpaths(content);

  if (!subpaths || subpaths.length < 2) {
    return content;
  }

  const polylines = subpaths.map(toPolyline);
  const areas = polylines.map(signedArea);
  const depths = polylines.map(
    (polyline, index) => polylines.filter((otherPolyline, otherIndex) => otherIndex !== index && isPointInPolygon(polyline[0], otherPolyline)).length
  );

  const referenceIndex = depths.findIndex((depth, index) => depth === 0 && areas[index] !== 0);
  if (referenceIndex === -1) {
    return content;
  }

  const referenceSign = Math.sign(areas[referenceIndex]);

  return subpaths.flatMap((subpath, index) => {
    const expectedSign = depths[index] % 2 === 0 ? referenceSign : -referenceSign;

    return areas[index] !== 0 && Math.sign(areas[index]) !== expectedSign ? reverseSubpath(subpath) : serializeSubpath(subpath);
  });
}
