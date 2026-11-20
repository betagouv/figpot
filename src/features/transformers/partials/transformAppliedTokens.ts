import { Paint, VariableAlias } from '@figpot/src/clients/figma';
import { isTokenContextsEnabled, resolveThemeIdForMode } from '@figpot/src/features/translators/tokens/translateTokens';
import { SubcanvasNodeWithSlot } from '@figpot/src/models/entities/figma/slot';
import { TokenType } from '@figpot/src/models/entities/penpot/traits/token';
import { TokenScope } from '@figpot/src/models/entities/penpot/traits/token';
import { AbstractRegistry, BoundVariableRegistry } from '@figpot/src/models/entities/registry';

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

  // The token of the property's type, or else one the variable gives: Figma can bind a variable scoped to another use
  // (a size variable on a radius), its token then holds the same value
  const variableTokenNames = registry.getVariableTokenNames();
  const tokenName =
    variableTokenNames.get(`${single.id}/${tokenType}`) ??
    FALLBACK_TOKEN_TYPES.map((type) => variableTokenNames.get(`${single.id}/${type}`)).find((name) => name !== undefined);
  if (tokenName !== undefined) {
    appliedTokens[penpotProperty] = tokenName;
  }
}

const FALLBACK_TOKEN_TYPES: TokenType[] = [
  'sizing',
  'spacing',
  'borderRadius',
  'borderWidth',
  'number',
  'opacity',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'fontFamily',
  'color',
  'string',
  'boolean',
];

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
// With token contexts, the variable modes a Figma node sets for itself and its children (`explicitVariableModes`) become the
// themes of a Penpot token scope: the groups it does not name are inherited, as in Figma. Modes of unknown collections are
// left out (warned once), so the node inherits them
let hasWarnedUnknownVariableModes = false;

// The Figma ID of the node a copy node mirrors in its near main: a nested node `I<instance>;<rest>` mirrors `<rest>` (itself
// prefixed when nested deeper), an instance its component node. Same "near main" as Penpot's `shapeRef`
function getNearMainNodeId(node: SubcanvasNodeWithSlot): string | undefined {
  if (node.id.startsWith('I') && node.id.includes(';')) {
    const rest = node.id.slice(node.id.indexOf(';') + 1);

    return rest.includes(';') ? `I${rest}` : rest;
  }

  return node.type === 'INSTANCE' ? node.componentId : undefined;
}

function translateThemeIds(registry: BoundVariableRegistry, node: SubcanvasNodeWithSlot, explicitVariableModes: Record<string, string>): string[] {
  const themes: string[] = [];
  const unknown: string[] = [];

  for (const [collectionId, modeId] of Object.entries(explicitVariableModes)) {
    const themeId = resolveThemeIdForMode(registry.getThemeIdsByCollectionMode(), collectionId, modeId);
    if (themeId) {
      themes.push(themeId);
    } else {
      unknown.push(collectionId);
    }
  }

  if (unknown.length > 0 && !hasWarnedUnknownVariableModes) {
    hasWarnedUnknownVariableModes = true;

    console.warn(
      `some Figma nodes (for example "${node.name}") set variable modes of collections the variables API does not describe (${unknown.join(', ')}), those modes are not transferred: synchronize with the libraries defining them`
    );
  }

  return themes;
}

function transformTokenScope(registry: BoundVariableRegistry, node: SubcanvasNodeWithSlot): TokenScope | undefined {
  const explicitVariableModes = node.explicitVariableModes;
  if (!explicitVariableModes) {
    return undefined;
  }

  // Sorted so the comparison with the Penpot file does not see a difference from the order alone
  const themes = translateThemeIds(registry, node, explicitVariableModes).sort();
  if (themes.length === 0) {
    return undefined;
  }

  // A copy node whose modes Figma marks as overridden lists the groups it changes compared to its near main: Penpot keeps
  // those on sync and follows the main for the others. When the main is not in this file (library component), the list
  // is left out and Penpot keeps the whole scope
  const { explicitModesByNodeId, themeGroupById } = registry.getTokenScopeIndex();
  const mainNodeId = getNearMainNodeId(node);
  const overridden = (registry as Partial<AbstractRegistry>).getOverrides?.(node.id)?.includes('explicitVariableModes');

  if (overridden && mainNodeId && explicitModesByNodeId.has(mainNodeId)) {
    const mainModes = explicitModesByNodeId.get(mainNodeId);
    const mainThemes = new Set(mainModes ? translateThemeIds(registry, node, mainModes) : []);
    const themeSet = new Set(themes);
    const overrides = new Set<string>();

    for (const themeId of [...themes, ...mainThemes]) {
      const group = themeGroupById.get(themeId);
      if (group !== undefined && themeSet.has(themeId) !== mainThemes.has(themeId)) {
        overrides.add(group);
      }
    }

    return { themes: themes, overrides: [...overrides].sort() };
  }

  return { themes: themes };
}

export function transformAppliedTokens(
  registry: BoundVariableRegistry,
  node: SubcanvasNodeWithSlot
): { appliedTokens?: Record<string, string>; tokenScope?: TokenScope } {
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
    record('letterSpacing', 'letterSpacing', boundVariables.letterSpacing);

    // Components and instances bind their corner radii there instead of the `*Radius` fields
    const cornerRadii = boundVariables.rectangleCornerRadii;
    record('r1', 'borderRadius', cornerRadii?.RECTANGLE_TOP_LEFT_CORNER_RADIUS);
    record('r2', 'borderRadius', cornerRadii?.RECTANGLE_TOP_RIGHT_CORNER_RADIUS);
    record('r3', 'borderRadius', cornerRadii?.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS);
    record('r4', 'borderRadius', cornerRadii?.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS);

    // Penpot only applies the minimum and maximum sizes to children of a flex or grid layout, whereas Figma also applies
    // them to an auto layout frame itself: the token is kept anyway so the value follows the theme where Penpot uses it
    record('layoutItemMinW', 'sizing', boundVariables.minWidth);
    record('layoutItemMaxW', 'sizing', boundVariables.maxWidth);
    record('layoutItemMinH', 'sizing', boundVariables.minHeight);
    record('layoutItemMaxH', 'sizing', boundVariables.maxHeight);

    // Missing from the generated types although the REST API sends them
    const extraBoundVariables = boundVariables as { strokeWeight?: VariableAlias; gridRowGap?: VariableAlias; gridColumnGap?: VariableAlias };

    // Penpot has a stroke width token per side, a uniform weight binds the four of them. The REST API names the sides
    // `BORDER_TOP_WEIGHT`... whereas the generated types (from the Plugin API) name them `top`...
    const strokeWeights = boundVariables.individualStrokeWeights as
      | (Partial<Record<'top' | 'right' | 'bottom' | 'left', VariableAlias>> &
          Partial<Record<'BORDER_TOP_WEIGHT' | 'BORDER_RIGHT_WEIGHT' | 'BORDER_BOTTOM_WEIGHT' | 'BORDER_LEFT_WEIGHT', VariableAlias>>)
      | undefined;
    record('strokeWidthTop', 'borderWidth', strokeWeights?.top ?? strokeWeights?.BORDER_TOP_WEIGHT ?? extraBoundVariables.strokeWeight);
    record('strokeWidthRight', 'borderWidth', strokeWeights?.right ?? strokeWeights?.BORDER_RIGHT_WEIGHT ?? extraBoundVariables.strokeWeight);
    record('strokeWidthBottom', 'borderWidth', strokeWeights?.bottom ?? strokeWeights?.BORDER_BOTTOM_WEIGHT ?? extraBoundVariables.strokeWeight);
    record('strokeWidthLeft', 'borderWidth', strokeWeights?.left ?? strokeWeights?.BORDER_LEFT_WEIGHT ?? extraBoundVariables.strokeWeight);

    // Grid layouts have their own gap fields
    record('rowGap', 'spacing', extraBoundVariables.gridRowGap);
    record('columnGap', 'spacing', extraBoundVariables.gridColumnGap);
  }

  // No line height token: Penpot has none on its own (only inside a typography token, where a value in pixels is turned
  // into a ratio of the font size), and it would apply the pixels of a Figma line height variable as that ratio (24px
  // becoming 24 times the font size). The ratio written in the text content stays right, it just does not follow themes

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

  const tokenScope = isTokenContextsEnabled() ? transformTokenScope(registry, node) : undefined;

  const explicitVariableModes = node.explicitVariableModes;
  if (!isTokenContextsEnabled() && !hasWarnedExplicitVariableModes && explicitVariableModes && Object.keys(explicitVariableModes).length > 0) {
    hasWarnedExplicitVariableModes = true;

    console.warn(
      `at least one Figma node (for example "${node.name}") sets a per-frame variable mode override which Penpot cannot honour (theme switching is document-wide). figpot opens the Penpot file with no theme active, so the canvas mirrors whatever Figma rendered. Toggling a theme in Penpot will rebind every variable-driven property of every node at once — frames you laid out for different modes in Figma will all flip together`
    );
  }

  return {
    ...(Object.keys(appliedTokens).length > 0 ? { appliedTokens: appliedTokens } : {}),
    ...(tokenScope ? { tokenScope: tokenScope } : {}),
  };
}
