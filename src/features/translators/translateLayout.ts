import {
  gridChildHorizontalAlign as FigmaGridChildAlign,
  HasChildrenTrait,
  HasFramePropertiesTrait,
  HasLayoutTrait,
  SubcanvasNode,
} from '@figpot/src/clients/figma';
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
      return 'start';
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
      return 'start';
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
      return 'start';
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
      //
      // A single child laid out is already made to hug before by `adaptFillingOnlyChild()`, so this only applies to several children
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

/**
 * Splits a CSS track list on its top-level spaces and commas (the ones outside parentheses)
 */
function splitTrackList(trackList: string, separator: RegExp): string[] {
  const tracks: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of trackList) {
    if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth--;
    }

    if (depth === 0 && separator.test(character)) {
      if (current.trim()) {
        tracks.push(current.trim());
      }
      current = '';
    } else {
      current += character;
    }
  }

  if (current.trim()) {
    tracks.push(current.trim());
  }

  return tracks;
}

/**
 * Translates one CSS track size, `undefined` when it cannot be read
 */
function translateGridTrack(track: string): GridTrack | undefined {
  // Penpot has no minimum per track, the maximum is the size the track gets once there is room (`minmax(0,1fr)` is `1fr`)
  const minmax = /^minmax\((.*)\)$/.exec(track);
  if (minmax) {
    const bounds = splitTrackList(minmax[1], /,/);

    return bounds.length === 2 ? translateGridTrack(bounds[1]) : undefined;
  }

  const size = /^(\d+(?:\.\d+)?)(fr|px|%)$/.exec(track);
  if (size) {
    const value = parseFloat(size[1]);

    return size[2] === 'fr' ? { type: 'flex', value: value } : size[2] === 'px' ? { type: 'fixed', value: value } : { type: 'percent', value: value };
  }

  // `fit-content(100%)` is the "hug" of Figma, like `auto`, `min-content` and `max-content` it sizes the track from its content
  if (/^(fit-content\(.*\)|auto|min-content|max-content)$/.test(track)) {
    return { type: 'auto' };
  }

  return undefined;
}

/**
 * Translates the CSS-like track sizes Figma gives (`repeat(2,fit-content(100%))`, `372px 372px`, `minmax(0,1fr)`...).
 * Equal fractions are kept, as before reading them, when a size cannot be read or the sizes do not match the track count
 */
export function translateGridTracks(sizing: string | undefined, count: number): GridTrack[] {
  const tracks: (GridTrack | undefined)[] = [];

  for (const track of splitTrackList(sizing ?? '', /\s/)) {
    const repeat = /^repeat\((\d+),(.*)\)$/.exec(track);

    if (repeat) {
      const repeated = splitTrackList(repeat[2], /\s/).map(translateGridTrack);

      for (let i = 0; i < parseInt(repeat[1], 10); i++) {
        tracks.push(...repeated);
      }
    } else {
      tracks.push(translateGridTrack(track));
    }
  }

  if (tracks.length !== count || tracks.some((track) => track === undefined)) {
    return Array.from({ length: count }, () => ({ type: 'flex', value: 1 }));
  }

  return tracks as GridTrack[];
}

export function translateLayoutGridColumns(node: HasLayoutTrait): GridTrack[] {
  return translateGridTracks(node.gridColumnsSizing, node.gridColumnCount ?? 0);
}

export function translateLayoutGridRows(node: HasLayoutTrait): GridTrack[] {
  return translateGridTracks(node.gridRowsSizing, node.gridRowCount ?? 0);
}

export function translateGridChildAlign(align?: FigmaGridChildAlign): 'start' | 'center' | 'end' | undefined {
  // Figma's "AUTO" and an unset value both map to Penpot's omitted alignment (defaults to "auto" on Penpot side)
  switch (align) {
    case 'MIN':
      return 'start';
    case 'CENTER':
      return 'center';
    case 'MAX':
      return 'end';
    default:
      return undefined;
  }
}
