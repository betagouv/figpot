// Penpot accepts a limited character set in token, set and theme names
// With our logic anything else is stripped rather than rejected
const ALLOWED_CHARS = /[^a-zA-Z0-9\-$_.]/g;

// Unicode combining diacritical marks (`U+0300`..`U+036F`) — the `accent part` of a decomposed
// accented letter once it has been run through `String.prototype.normalize('NFD')`
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function sanitizeSegment(segment: string): string {
  // Replace accented letters to avoid having them stripped by the filter of allowed characters
  return segment
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '') // strip accents so `é` -> `e` rather than being dropped by the allowlist
    .trim()
    .replace(/\s+(.)/g, (_match, nextChar: string) => nextChar.toUpperCase()) // camelCase multi-word names: `mange a Paris` -> `mangeAParis`
    .replace(ALLOWED_CHARS, '');
}

// A token name nests with `.` inside a token set (matching how Penpot displays grouped tokens)
// `/` from the Figma variable name becomes `.` since both denote a grouping level
export function translateTokenName(figmaName: string): string {
  let name = figmaName
    .split('/')
    .map(sanitizeSegment)
    .filter((segment) => segment !== '')
    .join('.');

  name = name
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '')
    .replace(/^\$/, 'S');

  return name === '' ? 'unnamed' : name;
}

// A token-set path nests with `/` (Penpot displays sets as a folder tree). A Figma collection / mode
// name is a single segment that should not introduce slashes itself, so we just sanitize it
export function translateTokenSetPath(figmaName: string): string {
  const sanitized = sanitizeSegment(figmaName).replace(/^\$/, 'S');

  return sanitized === '' ? 'unnamed' : sanitized;
}

// Returns `name` if not already taken, otherwise appends `-1`, `-2`, ... until unique. The chosen
// value is added to `taken` so subsequent calls keep producing distinct names
export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);

    return name;
  }

  let suffix = 1;
  while (taken.has(`${name}-${suffix}`)) {
    suffix++;
  }

  const unique = `${name}-${suffix}`;
  taken.add(unique);

  return unique;
}
