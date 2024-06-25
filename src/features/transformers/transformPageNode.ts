import assert from 'assert';

import { CanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateChildren } from '@figpot/src/features/translators/translateChildren';
import { formatPageRootFrameId, registerId, translateId, translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { rgbToHex } from '@figpot/src/utils/color';

export function transformPageNode(figmaNode: CanvasNode, mapping: MappingType): PenpotPage {
  //
  // TODO: we should strip properties of Penpot features like `proportionLock`
  // to be sure it does not trigger a useless update
  //

  const penpotPageId = translateId(figmaNode.id, mapping);

  // When a page is created into Penpot a "root frame" is also created to wrap all child nodes. This one is immutable and has the ID `00000000-0000-0000-0000-000000000000`.
  // It implies this ID will occur X times if X pages, and it would break our graph since keyed by the node ID. So we add a temporary prefix to remove
  const virtualFigmaRootFrameId = formatPageRootFrameId(figmaNode.id);
  const penpotRootFrameId = formatPageRootFrameId(penpotPageId);

  // Force registration in case in a child the ID is used
  registerId(virtualFigmaRootFrameId, penpotRootFrameId, mapping);

  const page: PenpotPage = {
    id: penpotPageId,
    name: figmaNode.name,
    options: {
      background: rgbToHex(figmaNode.backgroundColor),
    },
    objects: {
      [translateUuidAsObjectKey(penpotRootFrameId)]: {
        id: penpotRootFrameId,
        parentId: penpotRootFrameId,
        frameId: penpotRootFrameId,
        name: 'Root Frame',
        type: 'frame',
        x: 0,
        y: 0,
        width: 0.01,
        height: 0.01,
        rotation: 0,
        selrect: {
          x: 0,
          y: 0,
          width: 0.01,
          height: 0.01,
          x1: 0,
          y1: 0,
          x2: 0.01,
          y2: 0.01,
        },
        points: [
          {
            x: 0,
            y: 0,
          },
          {
            x: 0.01,
            y: 0,
          },
          {
            x: 0.01,
            y: 0.01,
          },
          {
            x: 0,
            y: 0.01,
          },
        ],
        transform: {
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          e: 0,
          f: 0,
        },
        transformInverse: {
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          e: 0,
          f: 0,
        },
        flipX: null,
        flipY: null,
        hideFillOnExport: false,
        proportionLock: false,
        strokes: [],
        proportion: 1,
        fills: [
          {
            fillColor: '#FFFFFF', // The background is managed by the page option, not by the root frame ID so leaving the default here
            fillOpacity: 1,
          },
        ],
      },
    },
  };

  const registeredPageNodes: PenpotNode[] = [];

  translateChildren(registeredPageNodes, figmaNode.children, virtualFigmaRootFrameId, virtualFigmaRootFrameId, mapping);

  for (const penpotPageNode of registeredPageNodes) {
    assert(penpotPageNode.id); // It would mean we forget to translate it in a specific node type

    page.objects[translateUuidAsObjectKey(penpotPageNode.id)] = penpotPageNode;
  }

  return page;
}
