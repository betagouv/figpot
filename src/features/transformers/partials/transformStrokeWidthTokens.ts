import { PenpotPage } from '@figpot/src/models/entities/penpot/page';

const STROKE_WIDTH_PROPERTIES = ['strokeWidth', 'strokeWidthTop', 'strokeWidthRight', 'strokeWidthBottom', 'strokeWidthLeft'];

// Figma can bind the weight of strokes on a node without any visible stroke (a component whose border only shows in some
// variants, or an outline-only vector figpot draws as fills from its stroke geometry). Penpot applying a stroke width token
// to a shape without stroke creates one with its default black color, so such tokens are dropped
export function transformStrokeWidthTokens(page: PenpotPage): void {
  for (const node of Object.values(page.objects)) {
    const appliedTokens = (node as { appliedTokens?: Record<string, string> }).appliedTokens;
    const strokes = (node as { strokes?: unknown[] }).strokes;

    if (!appliedTokens || (strokes && strokes.length > 0)) {
      continue;
    }

    for (const property of STROKE_WIDTH_PROPERTIES) {
      delete appliedTokens[property];
    }

    if (Object.keys(appliedTokens).length === 0) {
      delete (node as { appliedTokens?: Record<string, string> }).appliedTokens;
    }
  }
}
