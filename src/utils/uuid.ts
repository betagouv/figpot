import { v5 as uuidv5 } from 'uuid';

// Fixed namespace so the same published Figma identifier always yields the same Penpot UUID across runs and
// across files. The value matches the one from `penpot-exporter-figma-plugin` so users can mix the use of both tools
const FIGPOT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const cache = new Map<string, string>();

export function deterministicUuid(figmaIdentifier: string): string {
  let penpotId = cache.get(figmaIdentifier);

  if (penpotId === undefined) {
    penpotId = uuidv5(figmaIdentifier, FIGPOT_NAMESPACE);

    cache.set(figmaIdentifier, penpotId);
  }

  return penpotId;
}
