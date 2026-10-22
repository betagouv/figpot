import { LayoutGrid } from '@figpot/src/clients/figma';
import { Grid } from '@figpot/src/models/entities/penpot/traits/grid';
import { rgbToHex } from '@figpot/src/utils/color';

// Same logic as the Penpot Figma plugin, Figma layout grids (guides displayed on frames) become Penpot board grids
export function translateGrids(layoutGrids: LayoutGrid[] | undefined): Grid[] | undefined {
  if (!layoutGrids || layoutGrids.length === 0) {
    return undefined;
  }

  return layoutGrids.map((layoutGrid): Grid => {
    const color = {
      color: rgbToHex(layoutGrid.color),
      opacity: layoutGrid.color.a,
    };

    if (layoutGrid.pattern === 'GRID') {
      return {
        type: 'square',
        display: layoutGrid.visible,
        params: { size: layoutGrid.sectionSize, color },
      };
    }

    return {
      type: layoutGrid.pattern === 'ROWS' ? 'row' : 'column',
      display: layoutGrid.visible,
      params: {
        color,
        type: translateGridAlignment(layoutGrid.alignment),
        // Figma uses a negative count for "auto", which is the absence of size for Penpot
        ...(layoutGrid.count > 0 ? { size: layoutGrid.count } : {}),
        margin: layoutGrid.offset,
        gutter: layoutGrid.gutterSize,
        itemLength: layoutGrid.sectionSize,
      },
    };
  });
}

function translateGridAlignment(alignment: LayoutGrid['alignment']): 'stretch' | 'left' | 'center' | 'right' {
  switch (alignment) {
    case 'MIN':
      return 'left';
    case 'MAX':
      return 'right';
    case 'CENTER':
      return 'center';
    case 'STRETCH':
    default:
      return 'stretch';
  }
}
