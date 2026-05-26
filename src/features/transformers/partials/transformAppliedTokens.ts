import { Paint, VariableAlias } from '@figpot/src/clients/figma';
import { SubcanvasNodeWithSlot } from '@figpot/src/models/entities/figma/slot';
import { TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

// Warned at most once per process: per-frame variable mode overrides have no Penpot equivalent
// (theme switching is document-wide), so flagging every offending node would be noise
let hasWarnedExplicitVariableModes = false;

function applyToken(
  appliedTokens: Record<string, string>,
  registry: BoundVariableRegistry,
  penpotProperty: string,
  tokenType: TokenType,
  alias: VariableAlias | VariableAlias[] | undefined
): void {
  if (!alias) {
    return;
  }

  const single = Array.isArray(alias) ? alias[0] : alias;
  if (!single) {
    return;
  }

  const tokenName = registry.getVariableTokenNames().get(`${single.id}/${tokenType}`);
  if (tokenName !== undefined) {
    appliedTokens[penpotProperty] = tokenName;
  }
}

// Figma layers paints front-to-back so the visible colour belongs to the topmost solid paint; the
// variable (if any) is bound on that specific paint, not on the node
function applyPaintColorToken(
  appliedTokens: Record<string, string>,
  registry: BoundVariableRegistry,
  penpotProperty: string,
  paints: readonly Paint[] | undefined
): void {
  if (!paints || paints.length === 0) {
    return;
  }

  const topPaint = paints[paints.length - 1];
  if (topPaint.type !== 'SOLID') {
    return;
  }

  applyToken(appliedTokens, registry, penpotProperty, 'color', topPaint.boundVariables?.color);
}

// Binds the Penpot shape to design tokens for every property Figma drives through a variable.
// We do NOT rewrite the shape's static value at sync time — Penpot opens with no theme active
// (see `translateTokens` for the rationale) so the static value mirrors what Figma rendered
// (including any per-frame `explicitVariableModes` override). Toggling a theme in Penpot then
// drives the rebind globally through `appliedTokens`
export function transformAppliedTokens(
  registry: BoundVariableRegistry,
  node: SubcanvasNodeWithSlot
): { appliedTokens?: Record<string, string> } {
  const appliedTokens: Record<string, string> = {};

  function record(penpotProperty: string, tokenType: TokenType, alias: VariableAlias | VariableAlias[] | undefined): void {
    applyToken(appliedTokens, registry, penpotProperty, tokenType, alias);
  }

  const boundVariables = node.boundVariables;
  if (boundVariables) {
    record('r1', 'borderRadius', boundVariables.topLeftRadius);
    record('r2', 'borderRadius', boundVariables.topRightRadius);
    record('r3', 'borderRadius', boundVariables.bottomRightRadius);
    record('r4', 'borderRadius', boundVariables.bottomLeftRadius);
    record('p1', 'spacing', boundVariables.paddingTop);
    record('p2', 'spacing', boundVariables.paddingRight);
    record('p3', 'spacing', boundVariables.paddingBottom);
    record('p4', 'spacing', boundVariables.paddingLeft);
    record('rowGap', 'spacing', boundVariables.itemSpacing);
    record('columnGap', 'spacing', boundVariables.itemSpacing);
    record('opacity', 'opacity', boundVariables.opacity);
    record('width', 'sizing', boundVariables.size?.x);
    record('height', 'sizing', boundVariables.size?.y);
    record('fontFamily', 'fontFamily', boundVariables.fontFamily);
    record('fontSize', 'fontSize', boundVariables.fontSize);
    record('fontWeight', 'fontWeight', boundVariables.fontWeight);
    record('lineHeight', 'sizing', boundVariables.lineHeight);
    record('letterSpacing', 'letterSpacing', boundVariables.letterSpacing);
  }

  if (node.type === 'TEXT') {
    const styleBoundVariables = node.style.boundVariables;

    if (styleBoundVariables) {
      record('fontFamily', 'fontFamily', styleBoundVariables.fontFamily);
      record('fontSize', 'fontSize', styleBoundVariables.fontSize);
      record('fontWeight', 'fontWeight', styleBoundVariables.fontWeight);
      record('lineHeight', 'sizing', styleBoundVariables.lineHeight);
      record('letterSpacing', 'letterSpacing', styleBoundVariables.letterSpacing);
    }
  }

  applyPaintColorToken(appliedTokens, registry, 'fill', 'fills' in node ? node.fills : undefined);
  applyPaintColorToken(appliedTokens, registry, 'strokeColor', 'strokes' in node ? node.strokes : undefined);

  const explicitVariableModes = node.explicitVariableModes;
  if (!hasWarnedExplicitVariableModes && explicitVariableModes && Object.keys(explicitVariableModes).length > 0) {
    hasWarnedExplicitVariableModes = true;

    console.warn(
      `at least one Figma node (for example "${node.name}") sets a per-frame variable mode override which Penpot cannot honour (theme switching is document-wide). figpot opens the Penpot file with no theme active, so the canvas mirrors whatever Figma rendered. Toggling a theme in Penpot will rebind every variable-driven property of every node at once — frames you laid out for different modes in Figma will all flip together`
    );
  }

  return Object.keys(appliedTokens).length > 0 ? { appliedTokens: appliedTokens } : {};
}
