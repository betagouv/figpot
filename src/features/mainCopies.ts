import { Component, SubcanvasNode } from '@figpot/src/clients/figma';

// Figma ID -> component key of the copies located inside mains
// Note: a document using components of a library needs it to detect swaps inside their copies, since the Figma REST API
// does not provide the content of remote mains (see `retrieveLibraryMainCopies()` and `registerInstanceSwap()`)
export type MainCopies = Record<string, string>;

export function buildMainCopies(document: SubcanvasNode, components: Record<string, Component>): MainCopies {
  const mainCopies: MainCopies = {};

  const browse = (node: SubcanvasNode, insideMain: boolean) => {
    if (insideMain && node.type === 'INSTANCE') {
      mainCopies[node.id] = components[node.componentId]?.key ?? node.componentId;
    }

    for (const child of ('children' in node ? (node.children as SubcanvasNode[]) : undefined) ?? []) {
      browse(child, insideMain || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET');
    }
  };

  browse(document, false);

  return mainCopies;
}
