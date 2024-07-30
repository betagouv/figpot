import { HasFramePropertiesTrait, HasLayoutTrait } from '@figpot/src/clients/figma';
import {
  translateLayoutAlignContent,
  translateLayoutAlignItems,
  translateLayoutFlexDir,
  translateLayoutGap,
  translateLayoutItemAlignSelf,
  translateLayoutJustifyContent,
  translateLayoutJustifyItems,
  translateLayoutPadding,
  translateLayoutPaddingType,
  translateLayoutSizing,
  translateLayoutWrapType,
} from '@figpot/src/features/translators/translateLayout';
import { LayoutAttributes, LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';

export function transformAutoLayout(node: HasFramePropertiesTrait): LayoutAttributes {
  return node.layoutMode !== undefined && node.layoutMode !== 'NONE'
    ? {
        layout: 'flex',
        layoutFlexDir: translateLayoutFlexDir(node.layoutMode),
        layoutGap:
          node.itemSpacing !== undefined
            ? translateLayoutGap(node.layoutMode, node.itemSpacing, node.primaryAxisAlignItems === 'SPACE_BETWEEN')
            : undefined,
        layoutWrapType: node.layoutWrap ? translateLayoutWrapType(node.layoutWrap) : undefined,
        layoutPadding: translateLayoutPadding(node),
        layoutPaddingType: translateLayoutPaddingType(node),
        layoutJustifyContent: translateLayoutJustifyContent(node),
        layoutJustifyItems: translateLayoutJustifyItems(node),
        layoutAlignContent: translateLayoutAlignContent(node),
        layoutAlignItems: translateLayoutAlignItems(node),
      }
    : {};
}

export function transformLayoutAttributes(
  node: HasLayoutTrait
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
    layoutItemHSizing: node.layoutSizingHorizontal ? translateLayoutSizing(node.layoutSizingHorizontal) : undefined,
    layoutItemVSizing: node.layoutSizingVertical ? translateLayoutSizing(node.layoutSizingVertical) : undefined,
    layoutItemAlignSelf: node.layoutAlign ? translateLayoutItemAlignSelf(node.layoutAlign) : undefined,
    layoutItemAbsolute: node.layoutPositioning ? node.layoutPositioning === 'ABSOLUTE' : undefined,
    layoutItemMaxH: node.maxHeight ?? undefined,
    layoutItemMinH: node.minHeight ?? undefined,
    layoutItemMaxW: node.maxWidth ?? undefined,
    layoutItemMinW: node.minWidth ?? undefined,
  };
}
