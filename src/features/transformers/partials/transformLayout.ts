import { NIL as NIL_UUID, v5 as uuidv5 } from 'uuid';

import {
  gridChildHorizontalAlign as FigmaGridChildAlign,
  HasChildrenTrait,
  HasFramePropertiesTrait,
  HasLayoutTrait,
} from '@figpot/src/clients/figma';
import { translateId } from '@figpot/src/features/translators/translateId';
import {
  hasCounterAxisSpacing,
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
          ? translateLayoutGap(
              node.layoutMode,
              node.itemSpacing,
              node.primaryAxisAlignItems === 'SPACE_BETWEEN',
              hasCounterAxisSpacing(node) ? node.counterAxisSpacing ?? 0 : 0
            )
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

type FillingChild = {
  type: string;
  layoutMode?: string;
  layoutPositioning?: string;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  visible?: boolean;
  absoluteBoundingBox?: { height: number } | null;
  style?: { textAutoResize?: string; lineHeightPx?: number };
};

function isSingleLineText(node: FillingChild): boolean {
  const height = node.absoluteBoundingBox?.height;
  const lineHeight = node.style?.lineHeightPx;

  return height !== undefined && lineHeight !== undefined && height < lineHeight * 1.5;
}

/**
 * Gives the sizing that keeps the current size of a child no longer filling its parent on an axis
 */
function translateFilledSizing(child: FillingChild, axis: 'horizontal' | 'vertical'): 'HUG' | 'FIXED' {
  if (child.layoutMode === 'HORIZONTAL' || child.layoutMode === 'VERTICAL') {
    // Figma sizes it from its content, as when it hugs
    return 'HUG';
  } else if (child.type === 'TEXT' && child.style) {
    if (axis === 'vertical') {
      return child.style.textAutoResize === 'HEIGHT' || child.style.textAutoResize === 'WIDTH_AND_HEIGHT' ? 'HUG' : 'FIXED';
    } else if (child.style.textAutoResize === 'WIDTH_AND_HEIGHT') {
      return 'HUG';
    } else if (child.style.textAutoResize === 'HEIGHT' && isSingleLineText(child)) {
      // A single line text hugs its width without going on another line
      child.style.textAutoResize = 'WIDTH_AND_HEIGHT';

      return 'HUG';
    }
  }

  // A wrapping text would go on a single line, and other shapes cannot hug anything
  return 'FIXED';
}

/**
 * In Figma a child filling an axis of an auto layout frame hugging its content on that axis, when it is the only child laid
 * out in it (absolute and hidden ones aside), just keeps its own size and the frame hugs it. Penpot does not allow a child
 * filling a hugging parent (`translateLayoutSizing()` then fixes the size of the frame), so the child keeps its size instead:
 * it renders the same and the frame still follows the size of its child (a text whose font size comes from tokens).
 *
 * It must run on a frame before translating its own sizing and its children (it adjusts the Figma children in place)
 */
export function adaptFillingOnlyChild(node: {
  layoutMode?: string;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  children?: object[];
}): void {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') {
    return;
  }

  // Only the properties read here matter, whatever the type of the Figma children
  const laidOutChildren = ((node.children ?? []) as FillingChild[]).filter(
    (child) => child.layoutPositioning !== 'ABSOLUTE' && child.visible !== false
  );
  if (laidOutChildren.length !== 1) {
    return;
  }

  const [child] = laidOutChildren;

  if (node.layoutSizingHorizontal === 'HUG' && child.layoutSizingHorizontal === 'FILL') {
    child.layoutSizingHorizontal = translateFilledSizing(child, 'horizontal');
  }

  if (node.layoutSizingVertical === 'HUG' && child.layoutSizingVertical === 'FILL') {
    child.layoutSizingVertical = translateFilledSizing(child, 'vertical');
  }
}

/**
 * An auto layout frame hugging its content takes the size of the children laid out in it. When there are none (they are all
 * positioned absolutely, hidden, or removed by the exclusions), Figma keeps the frame size whereas Penpot collapses it at the
 * next layout computation, with its absolute children (an icon placed absolutely in a frame disappears after a variant switch).
 * Its Figma size is kept as a fixed one on the hugging axes instead.
 *
 * It must run on a frame before translating its own sizing (it adjusts the Figma node in place)
 */
export function freezeHuggingFrameWithoutLaidOutChildren(
  node: Partial<
    Pick<
      HasFramePropertiesTrait & HasLayoutTrait,
      'layoutMode' | 'layoutSizingHorizontal' | 'layoutSizingVertical' | 'primaryAxisSizingMode' | 'counterAxisSizingMode'
    >
  > & {
    children?: object[];
  }
): void {
  if (!node.children || !node.layoutMode || node.layoutMode === 'NONE') {
    return;
  }

  // Only the properties read here matter, whatever the type of the Figma children
  const hasLaidOutChildren = (node.children as FillingChild[]).some((child) => child.layoutPositioning !== 'ABSOLUTE' && child.visible !== false);
  if (hasLaidOutChildren) {
    return;
  }

  const isHorizontalLayout = node.layoutMode === 'HORIZONTAL';

  if (node.layoutSizingHorizontal === 'HUG') {
    node.layoutSizingHorizontal = 'FIXED';

    // Legacy properties expressing the same along the layout axes
    if (isHorizontalLayout) {
      node.primaryAxisSizingMode = 'FIXED';
    } else {
      node.counterAxisSizingMode = 'FIXED';
    }
  }

  if (node.layoutSizingVertical === 'HUG') {
    node.layoutSizingVertical = 'FIXED';

    if (isHorizontalLayout) {
      node.counterAxisSizingMode = 'FIXED';
    } else {
      node.primaryAxisSizingMode = 'FIXED';
    }
  }
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
