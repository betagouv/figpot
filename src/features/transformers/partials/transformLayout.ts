import { NIL as NIL_UUID, v5 as uuidv5 } from 'uuid';

import {
  gridChildHorizontalAlign as FigmaGridChildAlign,
  HasChildrenTrait,
  HasFramePropertiesTrait,
  HasLayoutTrait,
} from '@figpot/src/clients/figma';
import { translateId } from '@figpot/src/features/translators/translateId';
import {
  translateGridChildAlign,
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
import { GridCell, LayoutAttributes, LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { AbstractRegistry } from '@figpot/src/models/entities/registry';

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
      // Grid-mode gaps come from dedicated Figma fields (`gridRowGap` / `gridColumnGap`), not `itemSpacing` which is flex-only.
      // The flex-oriented `layout.layoutGap` / `layout.layoutGapType` computed above are undefined for GRID, so we override here.
      const gridRowGap = node.gridRowGap ?? 0;
      const gridColumnGap = node.gridColumnGap ?? 0;
      const hasGridGap = node.gridRowGap !== undefined || node.gridColumnGap !== undefined;

      // `layoutGridCells` is generated in `buildLayoutGridCells` after children are transformed — it needs the Penpot-mapped child ids
      return {
        ...layout,
        layout: 'grid',
        layoutGap: hasGridGap ? { rowGap: gridRowGap, columnGap: gridColumnGap } : layout.layoutGap,
        layoutGapType: hasGridGap ? (gridRowGap === gridColumnGap ? 'simple' : 'multiple') : layout.layoutGapType,
        layoutGridDir: translateLayoutGridDir(node),
        layoutGridColumns: translateLayoutGridColumns(node),
        layoutGridRows: translateLayoutGridRows(node),
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

// Generates `layoutGridCells` for a grid container. Without cell assignments, Penpot's layout engine can't place children in cells
// and they collapse to intrinsic (padding-only) width on the cross axis after hydration.
// Figma exposes per-child anchors/spans (`gridRowAnchorIndex`, `gridColumnAnchorIndex`, `gridRowSpan`, `gridColumnSpan`);
// when absent we auto-place sequentially in the row-major order used by `translateLayoutGridDir` (always "row" today).
export function buildLayoutGridCells(
  registry: AbstractRegistry,
  node: HasLayoutTrait & HasFramePropertiesTrait & Partial<HasChildrenTrait>,
  penpotChildIds: string[]
): { [uuid: string]: GridCell } | undefined {
  if (node.layoutMode !== 'GRID' || !node.children || node.children.length === 0 || penpotChildIds.length === 0) {
    return undefined;
  }

  const columnCount = Math.max(node.gridColumnCount ?? 1, 1);
  const cells: { [uuid: string]: GridCell } = {};
  const mapping = registry.getMapping();

  // `transformChildren` may produce fewer/reordered ids than Figma has children (e.g. a mask collapses several siblings into a
  // single synthetic mask group), so we can't zip by index. Instead iterate Figma's children, translate each to its Penpot id
  // via the mapping, and include only those whose translated id actually ended up as a direct shape in the container.
  const validPenpotIds = new Set(penpotChildIds);

  node.children.forEach((figmaChildNode, figmaIndex) => {
    // Figma's child-level grid placement properties aren't declared on every `SubcanvasNode` variant, so we read them via a loose cast
    const figmaChild = figmaChildNode as {
      id: string;
      gridRowAnchorIndex?: number;
      gridColumnAnchorIndex?: number;
      gridRowSpan?: number;
      gridColumnSpan?: number;
      gridChildHorizontalAlign?: FigmaGridChildAlign;
      gridChildVerticalAlign?: FigmaGridChildAlign;
    };

    const penpotChildId = translateId(figmaChild.id, mapping);
    if (!validPenpotIds.has(penpotChildId)) {
      // Child was folded into a synthetic shape (e.g. mask group) or otherwise doesn't live directly under this container
      return;
    }

    const hasExplicitAnchor = typeof figmaChild.gridRowAnchorIndex === 'number' && typeof figmaChild.gridColumnAnchorIndex === 'number';

    let row: number;
    let column: number;
    if (hasExplicitAnchor) {
      // Figma anchors are 0-based, Penpot cells are 1-based (CSS-grid convention)
      row = (figmaChild.gridRowAnchorIndex as number) + 1;
      column = (figmaChild.gridColumnAnchorIndex as number) + 1;
    } else {
      // Default flow: row-major using Figma's original position, matches `translateLayoutGridDir` returning "row"
      row = Math.floor(figmaIndex / columnCount) + 1;
      column = (figmaIndex % columnCount) + 1;
    }

    const alignSelf = translateGridChildAlign(figmaChild.gridChildVerticalAlign);
    const justifySelf = translateGridChildAlign(figmaChild.gridChildHorizontalAlign);

    // Derive a deterministic cell id from the child's id (stable across syncs → no microdiff churn on `layoutGridCells`)
    const cellId = uuidv5(penpotChildId, NIL_UUID);

    cells[cellId] = {
      id: cellId,
      row,
      rowSpan: Math.max(figmaChild.gridRowSpan ?? 1, 1),
      column,
      columnSpan: Math.max(figmaChild.gridColumnSpan ?? 1, 1),
      position: hasExplicitAnchor ? 'manual' : 'auto',
      ...(alignSelf !== undefined ? { alignSelf } : {}),
      ...(justifySelf !== undefined ? { justifySelf } : {}),
      shapes: [penpotChildId],
    };
  });

  return cells;
}
