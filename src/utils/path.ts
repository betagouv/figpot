// Same normalization as Penpot (`app.common.path-names/clean-path`): segments are trimmed, empty ones are removed, and they
// are joined with a space around the separator. Penpot validates that names built from paths are normalized this way
export function cleanPath(path: string): string {
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .join(' / ');
}
