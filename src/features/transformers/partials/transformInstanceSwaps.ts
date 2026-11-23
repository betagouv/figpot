import { Component, InstanceNode, SubcanvasNode } from '@figpot/src/clients/figma';
import { MainCopies } from '@figpot/src/features/mainCopies';
import { translateComponentShapeId } from '@figpot/src/features/translators/translateId';

// A nested instance whose component has been swapped in Figma (e.g. another variant) must
// refer to its new component, and keep the replaced shape of the near main as "swap slot", otherwise Penpot rejects it
// since its component differs from the one of the shape it refers to. The state is reset for each document

type SwapContext = {
  nodes: Map<string, SubcanvasNode>;
  components: Record<string, Component>;
  remoteComponentSourceFiles: Map<string, string>; // Component key -> Figma file of its library
  libraryMainCopies: Map<string, MainCopies>; // Figma file of a library -> copies inside its mains
  // Figma ID of a swapped instance -> swap slot (Penpot ID of the replaced shape in the near main)
  swappedInstances: Map<string, string>;
};

let context: SwapContext = emptyContext();

function emptyContext(): SwapContext {
  return { nodes: new Map(), components: {}, remoteComponentSourceFiles: new Map(), libraryMainCopies: new Map(), swappedInstances: new Map() };
}

export function initializeInstanceSwaps(
  document: SubcanvasNode,
  components: Record<string, Component>,
  remoteComponentSourceFiles: Map<string, string> = new Map(),
  libraryMainCopies: Map<string, MainCopies> = new Map()
): void {
  const nodes = new Map<string, SubcanvasNode>();

  const index = (node: SubcanvasNode) => {
    nodes.set(node.id, node);

    for (const child of ('children' in node ? (node.children as SubcanvasNode[]) : undefined) ?? []) {
      index(child);
    }
  };

  index(document);

  context = { nodes, components, remoteComponentSourceFiles, libraryMainCopies, swappedInstances: new Map() };
}

// The context indexes the whole Figma document, it must be released once transformed so the next steps can use the memory
export function releaseInstanceSwaps(): void {
  context = emptyContext();
}

// A nested node ID is `I<instance>;<path in main>`, but inside a swapped instance the path belongs to the new component, so
// it is resolved relative to the closest swapped ancestor (the anchor)
function getRelatedPath(nodeId: string): { anchorId: string; relatedNodeId: string } | undefined {
  const ids = nodeId.split(';');

  for (let i = ids.length - 1; i > 0; i--) {
    if (i === 1 || context.swappedInstances.has(ids.slice(0, i).join(';'))) {
      return { anchorId: ids.slice(0, i).join(';'), relatedNodeId: ids.slice(i).join(';') };
    }
  }

  return undefined;
}

export function getRelatedNodeId(nodeId: string): string | undefined {
  return getRelatedPath(nodeId)?.relatedNodeId;
}

function getComponentKey(componentId: string): string {
  return context.components[componentId]?.key ?? componentId;
}

// The Figma ID of the node a nested node refers to in its near main: when this path still goes through a nested instance,
// the node in the main has an ID prefixed with `I` (e.g. the path "1:2;5:1" is the node "I1:2;5:1" of the main)
// Note: only for looking up Figma nodes, Penpot IDs are derived without this prefix (see `translateComponentShapeId()`)
export function getNearMainNodeId(relatedNodeId: string): string {
  return relatedNodeId.includes(';') ? `I${relatedNodeId}` : relatedNodeId;
}

// The component key of the node a nested instance replaces in its near main, when this node is an instance
// Note: Figma IDs are only unique inside a file, so the near main is looked up in the file of the anchor component (the
// instance the path is relative to)
function getReplacedComponentKey(anchorId: string, replacedNodeId: string): string | undefined {
  // The outermost anchor is an instance of the document whose ID has no `I` prefix
  const anchorNode = context.nodes.get(anchorId) ?? context.nodes.get(anchorId.replace(/^I/, ''));
  if (!anchorNode || anchorNode.type !== 'INSTANCE') {
    return undefined;
  }

  // The near main of a library component is only known through the copies retrieved from its library, even when its library
  // cannot be resolved: looking it up in this document could match an unrelated node having the same ID
  if (context.components[anchorNode.componentId]?.remote === true) {
    const libraryFile = context.remoteComponentSourceFiles.get(getComponentKey(anchorNode.componentId));

    return libraryFile ? context.libraryMainCopies.get(libraryFile)?.[replacedNodeId] : undefined;
  }

  const replacedNode = context.nodes.get(replacedNodeId);

  return replacedNode && replacedNode.type === 'INSTANCE' ? getComponentKey(replacedNode.componentId) : undefined;
}

// Must be called before the instance children are transformed so their references follow the swap
export function registerInstanceSwap(node: InstanceNode): string | undefined {
  const relatedPath = getRelatedPath(node.id);
  if (!relatedPath) {
    return undefined;
  }

  const { anchorId, relatedNodeId } = relatedPath;
  const replacedComponentKey = getReplacedComponentKey(anchorId, getNearMainNodeId(relatedNodeId));

  // Unknown when not an instance, or when the near main is in a library whose mains could not be retrieved (the swap cannot be detected)
  if (!replacedComponentKey || replacedComponentKey === getComponentKey(node.componentId)) {
    return undefined;
  }

  const swapSlot = translateComponentShapeId(relatedNodeId);
  context.swappedInstances.set(node.id, swapSlot);

  return swapSlot;
}
