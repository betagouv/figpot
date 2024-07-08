import assert from 'assert';

import { PostCommandGetFileResponse } from '@figpot/src/clients/penpot';
import { formatPageRootFrameId, rootFrameId, translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';

export function cleanHostedDocument(hostedTree: PostCommandGetFileResponse): PenpotDocument {
  assert(hostedTree.data);

  // Remove fields not meaningful and specific to Penpot and those that are dynamic (so it can be compared to the conversion from Figma)

  const hostedData = hostedTree.data as PenpotDocument['data'];
  const pagesOrder = hostedData.pages;
  const pagesIndex = hostedData.pagesIndex;
  const colors = hostedData.colors;
  const typographies = hostedData.typographies;
  const components = hostedData.components;

  for (const [, page] of Object.entries(pagesIndex)) {
    // To avoid collission about Penpot fixed root frame IDs for each page we adjust
    // the name here so it will match the transformation done from Figma
    const rootFrameKey = translateUuidAsObjectKey(rootFrameId);
    const rootFrameNode = page.objects[rootFrameKey];

    assert(rootFrameNode); // Not having the root frame for this page would be abnormal

    const newRootFrameNodeId = formatPageRootFrameId(page.id);

    rootFrameNode.id = newRootFrameNodeId;
    rootFrameNode.parentId = newRootFrameNodeId;
    rootFrameNode.frameId = newRootFrameNodeId;

    // To go fully with this logic, also change the object key
    page.objects[translateUuidAsObjectKey(newRootFrameNodeId)] = rootFrameNode;
    delete page.objects[rootFrameKey];

    // Then manage the rest of the logic
    for (const [, object] of Object.entries(page.objects)) {
      object.parentId = object.parentId === rootFrameId ? newRootFrameNodeId : object.parentId;
      object.frameId = object.frameId === rootFrameId ? newRootFrameNodeId : object.frameId;

      // The backend is calculating the `touched` property when passing the `shapeRef` so no need to manage it ourselves
      delete object.touched;

      if (object.type === 'text') {
        // From the UI this is passed with all position for each texts, it would be really difficult to calculate it
        // on our own. Hopefully they are not required for the text to be correctly created, so ignoring it :)
        delete object.positionData;

        if (object.content?.children) {
          for (const textChild of object.content.children) {
            // Remove a random ID no provided at creation but present when fetching paragraph children (seems not important)
            delete textChild.key;
          }
        }
      }
    }
  }

  if (colors) {
    for (const [, color] of Object.entries(colors)) {
      // Cannot guess this when transforming
      delete color.modifiedAt;
    }
  }

  if (typographies) {
    for (const [, typography] of Object.entries(typographies)) {
      // Cannot guess this when transforming
      delete typography.modifiedAt;
    }
  }

  if (components) {
    for (const [componentIndex, component] of Object.entries(components)) {
      // Penpot performs a soft delete on components for some time, since they are returned by the API we have to ignore them
      if (component.deleted) {
        delete components[componentIndex];
      } else {
        // Cannot guess this when transforming
        delete component.modifiedAt;
      }
    }
  }

  return {
    name: hostedTree.name,
    data: {
      pages: pagesOrder,
      pagesIndex: pagesIndex,
      colors: colors,
      typographies: typographies,
      components: components,
    },
  };
}
