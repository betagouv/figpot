import { CanvasNode } from '@figpot/src/clients/figma';
import { transformChildrenWithParentId } from '@figpot/src/features/transformers/partials/transformChildren';
import { formatPageRootFrameId, registerId, translateId } from '@figpot/src/features/translators/translateId';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { PageRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';
import { rgbToHex } from '@figpot/src/utils/color';
import { neutralTransform } from '@figpot/src/utils/matrix';

export function transformPageNode(registry: PageRegistry, figmaNode: CanvasNode): PenpotPage {
  const penpotPageId = translateId(figmaNode.id, registry.getMapping());

  // When a page is created into Penpot a "root frame" is also created to wrap all child nodes. This one is immutable and has the ID `00000000-0000-0000-0000-000000000000`.
  // It implies this ID will occur X times if X pages, and it would break our graph since keyed by the node ID. So we add a temporary prefix to remove
  const virtualFigmaRootFrameId = formatPageRootFrameId(figmaNode.id);
  const penpotRootFrameId = formatPageRootFrameId(penpotPageId);

  // Force registration in case in a child the ID is used
  registerId(virtualFigmaRootFrameId, penpotRootFrameId, registry.getMapping());

  // We provide a transform cumulative variable so rotation is based on parents too (a page cannot have a rotation so starting with neutral transform)
  const childrenShapes = transformChildrenWithParentId(registry, figmaNode, virtualFigmaRootFrameId, virtualFigmaRootFrameId, neutralTransform);

  const page: PenpotPage = {
    id: penpotPageId,
    name: figmaNode.name,
    background: rgbToHex(figmaNode.backgroundColor),
    objects: {
      [penpotRootFrameId]: {
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
        shapes: childrenShapes,
      },
    },
  };

  for (const [_, penpotPageNode] of registry.getNodes()) {
    assert(penpotPageNode.id); // It would mean we forget to translate it in a specific node type

    page.objects[penpotPageNode.id] = penpotPageNode;
  }

  return page;
}
