import { HasChildrenTrait, HasFramePropertiesTrait, HasLayoutTrait, SubcanvasNode } from '@figpot/src/clients/figma';
import {
  GridTrack,
  JustifyAlignContent,
  JustifyAlignItems,
  LayoutAlignSelf,
  LayoutFlexDir,
  LayoutGap,
  LayoutGapType,
  LayoutGridDir,
  LayoutPadding,
  LayoutPaddingType,
  LayoutSizing,
  LayoutWrapType,
} from '@figpot/src/models/entities/penpot/layout';

type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';

type FigmaWrap = 'NO_WRAP' | 'WRAP';

type FigmaLayoutSizing = 'FIXED' | 'HUG' | 'FILL';

type FigmaLayoutAlign = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'INHERIT';

export function translateLayoutFlexDir(layoutMode: FigmaLayoutMode): LayoutFlexDir | undefined {
  switch (layoutMode) {
    case 'HORIZONTAL':
      return 'row-reverse';
    case 'VERTICAL':
      return 'column-reverse';
    default:
      return;
  }
}

export function translateLayoutGapType(layoutMode: FigmaLayoutMode, itemSpacing: number, auto: boolean = false): LayoutGapType {
  // TODO: when is it "simple"?
  return 'multiple';
}

export function translateLayoutGap(layoutMode: FigmaLayoutMode, itemSpacing: number, auto: boolean = false): LayoutGap {
  if (auto) {
    return {
      rowGap: 0,
      columnGap: 0,
    };
  }

  return {
    rowGap: layoutMode === 'VERTICAL' ? itemSpacing : 0,
    columnGap: layoutMode === 'HORIZONTAL' ? itemSpacing : 0,
  };
}

export function translateLayoutWrapType(wrap: FigmaWrap): LayoutWrapType {
  switch (wrap) {
    case 'NO_WRAP':
      return 'nowrap';
    case 'WRAP':
      return 'wrap';
  }
}

export function translateLayoutPadding(node: HasFramePropertiesTrait): LayoutPadding | undefined {
  return node.paddingTop !== undefined || node.paddingRight !== undefined || node.paddingBottom !== undefined || node.paddingLeft !== undefined
    ? {
        p1: node.paddingTop ?? 0,
        p2: node.paddingRight ?? 0,
        p3: node.paddingBottom ?? 0,
        p4: node.paddingLeft ?? 0,
      }
    : undefined;
}

export function translateLayoutPaddingType(node: HasFramePropertiesTrait): LayoutPaddingType {
  if (node.paddingTop === node.paddingBottom && node.paddingRight === node.paddingLeft) {
    return 'simple';
  }

  return 'multiple';
}

export function translateLayoutJustifyContent(node: HasFramePropertiesTrait): JustifyAlignContent {
  switch (node.primaryAxisAlignItems) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    case 'SPACE_BETWEEN':
      return 'space-between';
    default:
      return 'stretch';
  }
}

export function translateLayoutJustifyItems(node: HasFramePropertiesTrait): JustifyAlignItems {
  switch (node.primaryAxisAlignItems) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    default:
      return 'stretch';
  }
}

export function translateLayoutAlignContent(node: HasFramePropertiesTrait): JustifyAlignContent {
  switch (node.counterAxisAlignItems) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    default:
      return 'stretch';
  }
}

export function translateLayoutAlignItems(node: HasFramePropertiesTrait): JustifyAlignItems {
  switch (node.counterAxisAlignItems) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    default:
      return 'stretch';
  }
}

export function translateLayoutSizing<A extends 'layoutSizingHorizontal' | 'layoutSizingVertical'>(
  node: Pick<HasLayoutTrait, A> & Partial<HasChildrenTrait>,
  axis: A
): LayoutSizing | undefined {
  switch (node[axis]) {
    case 'FIXED':
      return 'fix';
    case 'HUG':
      // [WORKAROUND] Figma allows setting for the same exis on parent frame "fit content" and on the child frame "take 100%"
      // But Penpot does not. It's accepted by the API but will be overriden when hydrated with a browser instanciating the shape
      //
      // It seems the more common use case is the adjustability to depend on movement on parent frame (like for a component), so we
      // set it as fixed while keeping adjustibility in its nested children (ref: https://github.com/penpot/penpot/discussions/7163)
      //
      // Note: in Figma if there is multiple direct children, setting "take 100%" on one will automatically set "fixed size" on the parent frame
      // So it makes more sense to choose to mimic this behavior in Penpot when there is just one child
      if (
        node.children &&
        node.children.some((childNode) => {
          // We make sure it's not a type not having the `HasLayoutTrait`
          // (did try a type guard to set `HasLayoutTrait` but it was messing due `SubcanvasNode` having too many combination)
          return (
            childNode.type !== 'EMBED' &&
            childNode.type !== 'LINK_UNFURL' &&
            childNode.type !== 'SLICE' &&
            childNode.type !== 'WIDGET' &&
            childNode[axis] === 'FILL'
          );
        })
      ) {
        return 'fix';
      }

      return 'auto';
    case 'FILL':
      return 'fill';
    default:
      return undefined;
  }
}

export function translateLayoutItemAlignSelf(align: FigmaLayoutAlign): LayoutAlignSelf {
  switch (align) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    default:
      return 'stretch';
  }
}

export function translateLayoutGridDir(node: HasLayoutTrait): LayoutGridDir {
  return 'row';
}

export function translateLayoutGridColumns(node: HasLayoutTrait): GridTrack[] {
  // TODO: should be more complex, maybe parsed from
  // `"gridColumnsSizing": "  fit-content(100%) fit-content(100%)",`
  return Array.from({ length: node.gridColumnCount ?? 0 }, () => {
    return {
      type: 'flex',
      value: 1,
    };
  });
}

export function translateLayoutGridRows(node: HasLayoutTrait): GridTrack[] {
  // TODO: should be more complex, maybe parsed from
  // `"gridRowsSizing": "  fit-content(100%) fit-content(100%)",`
  return Array.from({ length: node.gridRowCount ?? 0 }, () => {
    return {
      type: 'flex',
      value: 1,
    };
  });
}
