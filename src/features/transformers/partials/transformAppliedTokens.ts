import { Paint, VariableAlias } from '@figpot/src/clients/figma';
import { hasCounterAxisSpacing } from '@figpot/src/features/translators/translateLayout';
import { SubcanvasNodeWithSlot } from '@figpot/src/models/entities/figma/slot';
import { TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';

// Warned at most once per process: per-frame variable mode overrides have no Penpot equivalent
// (theme switching is document-wide), so flagging every offending node would be noise
let hasWarnedExplicitVariableModes = false;

// The token types a number variable can give, by preference when the expected one is missing
const NUMBER_TOKEN_TYPES: TokenType[] = [
  'sizing',
  'spacing',
  'borderRadius',
  'borderWidth',
  'number',
  'opacity',
  'fontSize',
  'fontWeight',
  'letterSpacing',
];

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

  const variableTokenNames = registry.getVariableTokenNames();
  const tokenName =
    variableTokenNames.get(`${single.id}/${tokenType}`) ??
    // A number variable only gives the tokens of its Figma scopes (a variable scoped to sizes gives a `sizing` token, even when
    // a radius uses it): Penpot applies a token to an attribute whatever its type, so another number token of it is fine
    (NUMBER_TOKEN_TYPES.includes(tokenType)
      ? NUMBER_TOKEN_TYPES.map((type) => variableTokenNames.get(`${single.id}/${type}`)).find((name) => name !== undefined)
      : undefined);

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
export function transformAppliedTokens(registry: BoundVariableRegistry, node: SubcanvasNodeWithSlot): { appliedTokens?: Record<string, string> } {
  const appliedTokens: Record<string, string> = {};

  function record(penpotProperty: string, tokenType: TokenType, alias: VariableAlias | VariableAlias[] | undefined): void {
    applyToken(appliedTokens, registry, penpotProperty, tokenType, alias);
  }

  const boundVariables = node.boundVariables;
  if (boundVariables) {
    // The radii of a rectangle are bound per corner under another name than for frames
    const cornerRadii = boundVariables.rectangleCornerRadii;
    record('r1', 'borderRadius', boundVariables.topLeftRadius ?? cornerRadii?.RECTANGLE_TOP_LEFT_CORNER_RADIUS);
    record('r2', 'borderRadius', boundVariables.topRightRadius ?? cornerRadii?.RECTANGLE_TOP_RIGHT_CORNER_RADIUS);
    record('r3', 'borderRadius', boundVariables.bottomRightRadius ?? cornerRadii?.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS);
    record('r4', 'borderRadius', boundVariables.bottomLeftRadius ?? cornerRadii?.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS);
    record('p1', 'spacing', boundVariables.paddingTop);
    record('p2', 'spacing', boundVariables.paddingRight);
    record('p3', 'spacing', boundVariables.paddingBottom);
    record('p4', 'spacing', boundVariables.paddingLeft);

    // Like the gap values (see `translateLayoutGap()`), the spacing of a flex layout is the gap along its direction and the
    // spacing between its lines the other one when it wraps, and grid layouts have their own gaps (missing from the API types)
    const gridGaps = boundVariables as { gridRowGap?: VariableAlias; gridColumnGap?: VariableAlias };
    const layoutMode = 'layoutMode' in node ? node.layoutMode : undefined;
    const counterAxisSpacing = 'layoutWrap' in node && hasCounterAxisSpacing(node) ? boundVariables.counterAxisSpacing : undefined;
    record(
      'rowGap',
      'spacing',
      layoutMode === 'VERTICAL' ? boundVariables.itemSpacing : layoutMode === 'HORIZONTAL' ? counterAxisSpacing : gridGaps.gridRowGap
    );
    record(
      'columnGap',
      'spacing',
      layoutMode === 'HORIZONTAL' ? boundVariables.itemSpacing : layoutMode === 'VERTICAL' ? counterAxisSpacing : gridGaps.gridColumnGap
    );

    record('opacity', 'opacity', boundVariables.opacity);
    record('width', 'sizing', boundVariables.size?.x);
    record('height', 'sizing', boundVariables.size?.y);
    record('layoutItemMinW', 'sizing', boundVariables.minWidth);
    record('layoutItemMaxW', 'sizing', boundVariables.maxWidth);
    record('layoutItemMinH', 'sizing', boundVariables.minHeight);
    record('layoutItemMaxH', 'sizing', boundVariables.maxHeight);

    // The REST API names the sides `BORDER_*_WEIGHT` whereas its types name them like the Plugin API, and a single weight
    // for all the sides is bound as `strokeWeight` (missing from the types)
    const strokeWeights = boundVariables.individualStrokeWeights as
      | (Partial<Record<'top' | 'right' | 'bottom' | 'left', VariableAlias>> &
          Partial<Record<'BORDER_TOP_WEIGHT' | 'BORDER_RIGHT_WEIGHT' | 'BORDER_BOTTOM_WEIGHT' | 'BORDER_LEFT_WEIGHT', VariableAlias>>)
      | undefined;
    const strokeWeight = (boundVariables as { strokeWeight?: VariableAlias }).strokeWeight;
    record('strokeWidthTop', 'borderWidth', strokeWeights?.top ?? strokeWeights?.BORDER_TOP_WEIGHT ?? strokeWeight);
    record('strokeWidthRight', 'borderWidth', strokeWeights?.right ?? strokeWeights?.BORDER_RIGHT_WEIGHT ?? strokeWeight);
    record('strokeWidthBottom', 'borderWidth', strokeWeights?.bottom ?? strokeWeights?.BORDER_BOTTOM_WEIGHT ?? strokeWeight);
    record('strokeWidthLeft', 'borderWidth', strokeWeights?.left ?? strokeWeights?.BORDER_LEFT_WEIGHT ?? strokeWeight);
    record('fontFamily', 'fontFamily', boundVariables.fontFamily);
    record('fontSize', 'fontSize', boundVariables.fontSize);
    record('fontWeight', 'fontWeight', boundVariables.fontWeight);
    record('letterSpacing', 'letterSpacing', boundVariables.letterSpacing);
  }

  // Line heights are not bound: Penpot applies the value of a token as a ratio of the font size, whereas a Figma variable
  // gives pixels (a 24px line height would become 24 times the font size). The value itself is still translated as a ratio
  if (node.type === 'TEXT') {
    const styleBoundVariables = node.style.boundVariables;

    if (styleBoundVariables) {
      record('fontFamily', 'fontFamily', styleBoundVariables.fontFamily);
      record('fontSize', 'fontSize', styleBoundVariables.fontSize);
      record('fontWeight', 'fontWeight', styleBoundVariables.fontWeight);
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
