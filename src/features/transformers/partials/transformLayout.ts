import { HasChildrenTrait, HasFramePropertiesTrait, HasLayoutTrait } from '@figpot/src/clients/figma';
import {
  translateLayoutAlignContent,
  translateLayoutAlignItems,
  translateLayoutFlexDir,
  translateLayoutGap,
  translateLayoutGapType,
  translateLayoutGridColumns,
  translateLayoutGridDir,
  translateLayoutGridRows,
  translateLayoutItemAlignSelf,
  translateLayoutJustifyContent,
  translateLayoutJustifyItems,
  translateLayoutPadding,
  translateLayoutPaddingType,
  translateLayoutSizing,
  translateLayoutWrapType,
} from '@figpot/src/features/translators/translateLayout';
import { LayoutAttributes, LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';

export function transformAutoLayout(node: HasFramePropertiesTrait & HasLayoutTrait): LayoutAttributes {
  if (node.layoutMode !== undefined) {
    const layout = {
      layoutGapType: node.itemSpacing !== undefined ? translateLayoutGapType(node.layoutMode, node.itemSpacing, false) : undefined,
      layoutGap:
        node.itemSpacing !== undefined
          ? translateLayoutGap(node.layoutMode, node.itemSpacing, node.primaryAxisAlignItems === 'SPACE_BETWEEN')
          : undefined,
      layoutPadding: translateLayoutPadding(node),
      layoutPaddingType: translateLayoutPaddingType(node),
      layoutJustifyContent: translateLayoutJustifyContent(node),
      layoutJustifyItems: translateLayoutJustifyItems(node),
      layoutAlignContent: translateLayoutAlignContent(node),
      layoutAlignItems: translateLayoutAlignItems(node),
    };

    if (node.layoutMode === 'GRID') {
      return {
        ...layout,
        layout: 'grid',
        layoutGridDir: translateLayoutGridDir(node),
        layoutGridColumns: translateLayoutGridColumns(node),
        layoutGridRows: translateLayoutGridRows(node),
        // layoutGridCells: xxx, // TODO: it's taking properties from children, we prefer the hydratation process to auto set them (so we exclude this from being compared)
      };
    } else {
      return {
        ...layout,
        layout: 'flex',
        layoutFlexDir: translateLayoutFlexDir(node.layoutMode),
        layoutWrapType: node.layoutWrap ? translateLayoutWrapType(node.layoutWrap) : undefined,
      };
    }
  }

  return {};
}

export function transformLayoutAttributes(
  node: HasLayoutTrait & Partial<HasChildrenTrait>
): Pick<
  LayoutChildAttributes,
  | 'layoutItemHSizing'
  | 'layoutItemVSizing'
  | 'layoutItemAlignSelf'
  | 'layoutItemAbsolute'
  | 'layoutItemMaxH'
  | 'layoutItemMinH'
  | 'layoutItemMaxW'
  | 'layoutItemMinW'
> {
  return {
    layoutItemHSizing: translateLayoutSizing(node, 'layoutSizingHorizontal'),
    layoutItemVSizing: translateLayoutSizing(node, 'layoutSizingVertical'),
    layoutItemAlignSelf: node.layoutAlign ? translateLayoutItemAlignSelf(node.layoutAlign) : undefined,
    layoutItemAbsolute: node.layoutPositioning ? node.layoutPositioning === 'ABSOLUTE' : undefined,
    layoutItemMaxH: node.maxHeight ?? undefined,
    layoutItemMinH: node.minHeight ?? undefined,
    layoutItemMaxW: node.maxWidth ?? undefined,
    layoutItemMinW: node.minWidth ?? undefined,
  };
}
