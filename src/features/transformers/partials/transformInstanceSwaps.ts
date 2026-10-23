import { Component, InstanceNode, SubcanvasNode } from '@figpot/src/clients/figma';
import { deterministicUuid } from '@figpot/src/utils/uuid';

// A nested instance whose component has been swapped in Figma (e.g. another variant) must
// refer to its new component, and keep the replaced shape of the near main as "swap slot", otherwise Penpot rejects it
// since its component differs from the one of the shape it refers to. The state is reset for each document

type SwapContext = {
  nodes: Map<string, SubcanvasNode>;
  components: Record<string, Component>;
  // Figma ID of a swapped instance -> swap slot (Penpot ID of the replaced shape in the near main)
  swappedInstances: Map<string, string>;
};

let context: SwapContext = { nodes: new Map(), components: {}, swappedInstances: new Map() };

export function initializeInstanceSwaps(document: SubcanvasNode, components: Record<string, Component>): void {
  const nodes = new Map<string, SubcanvasNode>();

  const index = (node: SubcanvasNode) => {
    nodes.set(node.id, node);

    for (const child of ('children' in node ? (node.children as SubcanvasNode[]) : undefined) ?? []) {
      index(child);
    }
  };

  index(document);

  context = { nodes, components, swappedInstances: new Map() };
}

// The context indexes the whole Figma document, it must be released once transformed so the next steps can use the memory
export function releaseInstanceSwaps(): void {
  context = { nodes: new Map(), components: {}, swappedInstances: new Map() };
}

// A nested node ID is `I<instance>;<path in main>`, but inside a swapped instance the path belongs to the new component, so
// it is resolved relative to the closest swapped ancestor
export function getRelatedNodeId(nodeId: string): string | undefined {
  const ids = nodeId.split(';');

  for (let i = ids.length - 1; i > 0; i--) {
    if (i === 1 || context.swappedInstances.has(ids.slice(0, i).join(';'))) {
      return ids.slice(i).join(';');
    }
  }

  return undefined;
}

// The Figma ID of the node a nested node refers to in its near main: when this path still goes through a nested instance,
// the node in the main has an ID prefixed with `I` (e.g. the path "1:2;5:1" is the node "I1:2;5:1" of the main)
export function getNearMainNodeId(relatedNodeId: string): string {
  return relatedNodeId.includes(';') ? `I${relatedNodeId}` : relatedNodeId;
}

// Must be called before the instance children are transformed so their references follow the swap
export function registerInstanceSwap(node: InstanceNode): string | undefined {
  const relatedNodeId = getRelatedNodeId(node.id);
  if (!relatedNodeId) {
    return undefined;
  }

  const replacedNodeId = getNearMainNodeId(relatedNodeId);
  const replacedNode = context.nodes.get(replacedNodeId);
  if (!replacedNode || replacedNode.type !== 'INSTANCE') {
    return undefined; // The near main is not part of this document (remote component), the swap cannot be detected
  }

  const replacedComponentKey = context.components[replacedNode.componentId]?.key ?? replacedNode.componentId;
  const componentKey = context.components[node.componentId]?.key ?? node.componentId;

  if (replacedComponentKey === componentKey) {
    return undefined;
  }

  const swapSlot = deterministicUuid(replacedNodeId);
  context.swappedInstances.set(node.id, swapSlot);

  return swapSlot;
}
