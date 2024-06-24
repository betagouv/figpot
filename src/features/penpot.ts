import assert from 'assert';

import { PostCommandGetFileResponse } from '@figpot/src/clients/penpot';
import { formatPageRootFrameId, isPageRootFrame, rootFrameId } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';

export function cleanHostedDocument(hostedTree: PostCommandGetFileResponse): PenpotDocument {
  assert(hostedTree.data);

  // Remove fields not meaningful and specific to Penpot and those that are dynamic (so it can be compared to the conversion from Figma)

  const pagesIndex = (hostedTree.data as PenpotDocument['data']).pagesIndex;

  for (const [, page] of Object.entries(pagesIndex)) {
    // To avoid collission about Penpot fixed root frame IDs for each page we adjust
    // the name here so it will match the transformation done from Figma
    const rootFrameNode = page.objects[rootFrameId];

    assert(rootFrameNode); // Not having the root frame for this page would be abnormal

    if (rootFrameNode) {
      const newId = formatPageRootFrameId(page.id);

      rootFrameNode.id = newId;
      rootFrameNode.parentId = newId;
      rootFrameNode.frameId = newId;
    }

    // Then manage the rest of the logic
    for (const [, object] of Object.entries(page.objects)) {
      if (object.type === 'bool' || object.type === 'frame' || object.type === 'group') {
        delete object.shapes; // Since object is a reference it will act on the main object
      }
    }
  }

  return {
    name: hostedTree.name,
    data: {
      pagesIndex: pagesIndex,
    },
  };
}
