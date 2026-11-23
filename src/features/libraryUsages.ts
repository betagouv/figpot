import { GetFileResponse } from '@figpot/src/clients/figma';

export type LibraryUsage = {
  page: string;
  nodeId: string; // The outermost instance containing the reference (or the node itself), the one to look for in Figma
  nodeName: string;
  reference: string;
  hidden: boolean;
};

type BrowsedNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  componentId?: string;
  styles?: Record<string, string>;
  children?: BrowsedNode[];
};

// Lists where the given Figma library files are referenced so a user can find them, since references can be on layers
// the Figma libraries panel does not list (overrides on hidden layers inside instances)
export function findLibraryUsages(
  tree: Pick<GetFileResponse, 'document' | 'components' | 'styles'>,
  remoteComponents: Record<string, string>, // Component key -> Figma file
  remoteStyles: Record<string, string>, // Style key -> Figma file
  figmaFiles: Set<string>
): Map<string, LibraryUsage[]> {
  const usages = new Map<string, LibraryUsage[]>();
  const registered = new Map<string, LibraryUsage>();

  const register = (figmaFile: string | undefined, usage: LibraryUsage) => {
    if (!figmaFile || !figmaFiles.has(figmaFile)) {
      return;
    }

    // An override inside an instance is repeated on all its nested layers copies, only keep one per outermost instance
    // (flagged as hidden only if all its occurrences are, since then it is invisible from the Figma interface)
    const uniqueKey = `${figmaFile}|${usage.nodeId}|${usage.reference}`;
    const existingUsage = registered.get(uniqueKey);
    if (existingUsage) {
      existingUsage.hidden = existingUsage.hidden && usage.hidden;

      return;
    }
    registered.set(uniqueKey, usage);

    const fileUsages = usages.get(figmaFile);
    if (fileUsages) {
      fileUsages.push(usage);
    } else {
      usages.set(figmaFile, [usage]);
    }
  };

  const browse = (node: BrowsedNode, page: string, outerInstance: BrowsedNode | null, hidden: boolean) => {
    const currentHidden = hidden || node.visible === false;
    const currentOuterInstance = outerInstance ?? (node.type === 'INSTANCE' ? node : null);
    const location = currentOuterInstance ?? node;

    if (node.type === 'INSTANCE' && node.componentId) {
      const component = tree.components[node.componentId];

      if (component) {
        register(remoteComponents[component.key], {
          page,
          nodeId: location.id,
          nodeName: location.name,
          reference: `component "${component.name}"`,
          hidden: currentHidden,
        });
      }
    }

    for (const styleId of Object.values(node.styles ?? {})) {
      const style = tree.styles[styleId];

      if (style) {
        register(remoteStyles[style.key], {
          page,
          nodeId: location.id,
          nodeName: location.name,
          reference: `style "${style.name}"`,
          hidden: currentHidden,
        });
      }
    }

    for (const child of node.children ?? []) {
      browse(child, page, currentOuterInstance, currentHidden);
    }
  };

  for (const page of tree.document.children as unknown as BrowsedNode[]) {
    for (const child of page.children ?? []) {
      browse(child, page.name, null, false);
    }
  }

  return usages;
}

export function formatLibraryUsages(figmaDocumentId: string, usages: LibraryUsage[], limit = 10): string {
  // One line per node with all its references, nodes only having hidden references first since they are the hardest to find
  const nodes = new Map<string, { usage: LibraryUsage; references: Set<string>; hidden: boolean }>();
  for (const usage of usages) {
    const node = nodes.get(usage.nodeId);

    if (node) {
      node.references.add(usage.reference);
      node.hidden = node.hidden && usage.hidden;
    } else {
      nodes.set(usage.nodeId, { usage, references: new Set([usage.reference]), hidden: usage.hidden });
    }
  }

  const sortedNodes = [...nodes.values()].sort((a, b) => Number(b.hidden) - Number(a.hidden));
  const pagesCount = new Set(usages.map((usage) => usage.page)).size;
  const referencesCount = new Set(usages.map((usage) => usage.reference)).size;
  const hiddenCount = sortedNodes.filter((node) => node.hidden).length;

  const lines = [
    `  ${nodes.size} location(s) on ${pagesCount} page(s) using ${referencesCount} style(s) or component(s)${hiddenCount > 0 ? `, ${hiddenCount} only on hidden layers` : ''}:`,
    ...sortedNodes.slice(0, limit).map(({ usage, references, hidden }) => {
      const url = `https://www.figma.com/design/${figmaDocumentId}/?node-id=${usage.nodeId.replace(/:/g, '-')}`;

      return `  - page "${usage.page}", "${usage.nodeName}"${hidden ? ' (on hidden layers)' : ''}: ${[...references].join(', ')} ${url}`;
    }),
  ];

  if (sortedNodes.length > limit) {
    lines.push(`  - … and ${sortedNodes.length - limit} more`);
  }

  return lines.join('\n');
}
