import { SubcanvasNode } from '@figpot/src/clients/figma';
import { getNearMainNode } from '@figpot/src/features/transformers/partials/transformInstanceSwaps';
import { isTokenContextsEnabled, resolveThemeIdForMode } from '@figpot/src/features/translators/tokens/translateTokens';
import { TokenScope } from '@figpot/src/models/entities/penpot/traits/token';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

type ScopedNode = { id: string; name: string; explicitVariableModes?: Record<string, string> };

// Modes of unknown collections are left out (warned once per process), so the node inherits them
let hasWarnedUnknownVariableModes = false;

function translateThemeIds(
  registry: Pick<AbstractRegistry, 'getTokenContexts'>,
  node: ScopedNode,
  explicitVariableModes: Record<string, string>
): string[] {
  const { themeIdsByCollectionMode } = registry.getTokenContexts();
  const themeIds: string[] = [];
  const unknownCollectionIds: string[] = [];

  for (const [collectionId, modeId] of Object.entries(explicitVariableModes)) {
    const themeId = resolveThemeIdForMode(themeIdsByCollectionMode, collectionId, modeId);
    if (themeId) {
      themeIds.push(themeId);
    } else {
      unknownCollectionIds.push(collectionId);
    }
  }

  if (unknownCollectionIds.length > 0 && !hasWarnedUnknownVariableModes) {
    hasWarnedUnknownVariableModes = true;

    console.warn(
      `some Figma nodes (for example "${node.name}") set variable modes of collections the variables API does not describe (${unknownCollectionIds.join(', ')}), those modes are not transferred: export the library variables with the "figma-plugins/variables-export" plugin and pass the file with "--extra-variables <figmaId>:<path>" (see the README)`
    );
  }

  // Sorted so the comparison with the Penpot file does not see a difference from the order alone
  return themeIds.sort();
}

// With token contexts, the variable modes a Figma node sets for itself and its children (`explicitVariableModes`) become the
// themes of a Penpot token scope: the groups it does not name are inherited, as in Figma
export function transformTokenScope(
  registry: Pick<AbstractRegistry, 'getTokenContexts' | 'getOverrides'>,
  node: ScopedNode
): { tokenScope?: TokenScope } {
  if (!isTokenContextsEnabled() || !node.explicitVariableModes) {
    return {};
  }

  const themes = translateThemeIds(registry, node, node.explicitVariableModes);
  if (themes.length === 0) {
    return {};
  }

  // A copy node whose modes Figma marks as overridden lists the groups it changes compared to its near main: Penpot keeps
  // those on sync and follows the main for the others. When the main is not in this file (library component), the list is
  // left out and Penpot keeps the whole scope
  const mainNode = registry.getOverrides(node.id)?.includes('explicitVariableModes')
    ? (getNearMainNode(node as unknown as SubcanvasNode) as ScopedNode | undefined)
    : undefined;
  if (!mainNode) {
    return { tokenScope: { themes: themes } };
  }

  const { themeGroupById } = registry.getTokenContexts();
  const mainThemes = new Set(mainNode.explicitVariableModes ? translateThemeIds(registry, mainNode, mainNode.explicitVariableModes) : []);
  const themeSet = new Set(themes);
  const overrides = new Set<string>();

  for (const themeId of [...themes, ...mainThemes]) {
    const group = themeGroupById.get(themeId);
    if (group !== undefined && themeSet.has(themeId) !== mainThemes.has(themeId)) {
      overrides.add(group);
    }
  }

  return { tokenScope: { themes: themes, overrides: [...overrides].sort() } };
}
