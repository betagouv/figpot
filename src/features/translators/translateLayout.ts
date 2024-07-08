import { HasFramePropertiesTrait } from '@figpot/src/clients/figma';
import {
  JustifyAlignContent,
  JustifyAlignItems,
  LayoutAlignSelf,
  LayoutFlexDir,
  LayoutGap,
  LayoutPadding,
  LayoutSizing,
  LayoutWrapType,
} from '@figpot/src/models/entities/penpot/layout';

type FigmaLayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';

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

export function translateLayoutPaddingType(node: HasFramePropertiesTrait): 'simple' | 'multiple' {
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

export function translateLayoutSizing(sizing: FigmaLayoutSizing, isFrame: boolean = false): LayoutSizing {
  switch (sizing) {
    case 'FIXED':
      return 'fix';
    case 'HUG':
      return 'auto';
    case 'FILL':
      return 'fill';
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
