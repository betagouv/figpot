import svgPathParser from 'svg-path-parser';

import { PostGetFileResponse } from '@figpot/src/clients/penpot';
import { formatPageRootFrameId, rootFrameId } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

import { translateNonRotatedCommands } from './translators/vectors/translateNonRotatedCommands';

const { parseSVG } = svgPathParser;

export function cleanHostedDocument(hostedTree: PostGetFileResponse): PenpotDocument {
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
    const rootFrameKey = rootFrameId;
    const rootFrameNode = page.objects[rootFrameKey];

    assert(rootFrameNode); // Not having the root frame for this page would be abnormal

    const newRootFrameNodeId = formatPageRootFrameId(page.id);

    rootFrameNode.id = newRootFrameNodeId;
    rootFrameNode.parentId = newRootFrameNodeId;
    rootFrameNode.frameId = newRootFrameNodeId;

    // To go fully with this logic, also change the object key
    page.objects[newRootFrameNodeId] = rootFrameNode;
    delete page.objects[rootFrameKey];

    // Then manage the rest of the logic
    for (const [, object] of Object.entries(page.objects)) {
      object.parentId = object.parentId === rootFrameId ? newRootFrameNodeId : object.parentId;
      object.frameId = object.frameId === rootFrameId ? newRootFrameNodeId : object.frameId;

      // We sort them so when it's "refreshed" by the frontend the order won't matter (we did the same into `translateTouched()`)
      if (Array.isArray(object.touched)) {
        object.touched = object.touched.sort();
      }

      stripServerDerivedGeometry(object);

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
      } else if (object.type === 'path' || object.type === 'bool') {
        // The new Penpot API is no longer returning an array of commands but instead the inline SVG path.
        // Applies to both `path` and `bool` (boolean-op nodes expose their resolved shape as a path too).
        // We cannot compare it directly with the inline Figma SVG path provided due to logic of calculation, so instead
        // translating from here also to get same things for comparaison (transformed tree has to use commands, it cannot pushes inline path)
        if (typeof object.content === 'string' && (object.content as string).length > 0 && (object.content as string)[0] === 'M') {
          const normalizedPaths = parseSVG(object.content);

          object.content = translateNonRotatedCommands(normalizedPaths, 0, 0);
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

// When a node has `auto` or `fill` sizing on an axis, Penpot recomputes the corresponding dimension on hydration from its own
// text/content measurement (which differs slightly from Figma's). Pushing the Figma-derived dimension just triggers a perpetual
// diff between our value and Penpot's recomputed one. Stripping the derived fields from both sides (local after transform and
// remote in `cleanHostedDocument`) keeps microdiff in sync and lets Penpot's layout engine own the final numbers.
//
// `selrect` and `points` depend on both width and height, so we strip them entirely whenever any axis is server-derived.
// `x` / `y` are NOT touched — they are set by the parent container and never recomputed by Penpot itself.
export function stripServerDerivedGeometry(object: any): void {
  const vDerived = object.layoutItemVSizing === 'auto' || object.layoutItemVSizing === 'fill';
  const hDerived = object.layoutItemHSizing === 'auto' || object.layoutItemHSizing === 'fill';

  if (!vDerived && !hDerived) {
    return;
  }

  if (vDerived) {
    delete object.height;
  }
  if (hDerived) {
    delete object.width;
  }

  delete object.selrect;
  delete object.points;
}
