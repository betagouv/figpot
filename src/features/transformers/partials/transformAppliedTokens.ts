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
): VariableAlias | undefined {
  if (!alias) {
    return undefined;
  }

  const single = Array.isArray(alias) ? alias[0] : alias;
  if (!single) {
    return undefined;
  }

  const tokenName = registry.getVariableTokenNames().get(`${single.id}/${tokenType}`);
  if (tokenName !== undefined) {
    appliedTokens[penpotProperty] = tokenName;
  }

  return single;
}

// Figma layers paints front-to-back so the visible colour belongs to the topmost solid paint; the
// variable (if any) is bound on that specific paint, not on the node
function applyPaintColorToken(
  appliedTokens: Record<string, string>,
  registry: BoundVariableRegistry,
  penpotProperty: string,
  paints: readonly Paint[] | undefined
): VariableAlias | undefined {
  if (!paints || paints.length === 0) {
    return undefined;
  }

  const topPaint = paints[paints.length - 1];
  if (topPaint.type !== 'SOLID') {
    return undefined;
  }

  return applyToken(appliedTokens, registry, penpotProperty, 'color', topPaint.boundVariables?.color);
}

// Where each `record()` Penpot property lives on the shape. Keys whose path is `null` are skipped
// for the static-value override: `fontFamily` has two related shape slots (fontFamily + fontId)
// and we can only write one from here; `fill`/`strokeColor` are nested inside `fills[]`/`strokes[]`
// and handled by `translateSolidFill` directly
const PROPERTY_PATHS: Record<string, readonly string[] | null> = {
  r1: ['r1'],
  r2: ['r2'],
  r3: ['r3'],
  r4: ['r4'],
  opacity: ['opacity'],
  width: ['width'],
  height: ['height'],
  fontSize: ['fontSize'],
  fontWeight: ['fontWeight'],
  lineHeight: ['lineHeight'],
  letterSpacing: ['letterSpacing'],
  p1: ['layoutPadding', 'p1'],
  p2: ['layoutPadding', 'p2'],
  p3: ['layoutPadding', 'p3'],
  p4: ['layoutPadding', 'p4'],
  rowGap: ['layoutGap', 'rowGap'],
  columnGap: ['layoutGap', 'columnGap'],
  fontFamily: null,
  fill: null,
  strokeColor: null,
};

// Penpot requires every key of these nested objects to be present when the object itself is set.
// On a partial override we have to fill in the siblings with whatever the shape already has, so
// we do not collapse `layoutPadding` to a single-key map that fails the validator
const REQUIRED_NESTED_KEYS: Record<string, readonly string[]> = {
  layoutPadding: ['p1', 'p2', 'p3', 'p4'],
  layoutGap: ['rowGap', 'columnGap'],
};

function writeOverride(penpotNode: Record<string, unknown>, penpotProperty: string, value: number | string): void {
  const path = PROPERTY_PATHS[penpotProperty];
  if (!path) {
    return;
  }

  if (path.length === 1) {
    penpotNode[path[0]] = value;
    return;
  }

  // Two-level nested write: read the existing parent object, fill in any required sibling keys
  // Penpot's schema demands, then override only the targeted leaf
  const [parentKey, childKey] = path;
  const existing = (penpotNode[parentKey] as Record<string, unknown> | undefined) ?? {};
  const next: Record<string, unknown> = { ...existing };

  for (const requiredKey of REQUIRED_NESTED_KEYS[parentKey] ?? []) {
    if (next[requiredKey] === undefined) {
      next[requiredKey] = 0;
    }
  }
  next[childKey] = value;

  penpotNode[parentKey] = next;
}

// Binds the Penpot shape to design tokens for every property Figma drives through a variable, and
// (when the node uses `explicitVariableModes`) rewrites the static value Figma sent over with the
// variable's default-mode value — that way the initial rendering matches Penpot's active theme
// instead of staying frozen on the per-frame override. Mutates `penpotNode` for the static
// overrides (nested-aware) and returns the `appliedTokens` map for the caller to shallow-merge
export function transformAppliedTokens(
  registry: BoundVariableRegistry,
  node: SubcanvasNodeWithSlot,
  penpotNode: Record<string, unknown>
): { appliedTokens?: Record<string, string> } {
  const appliedTokens: Record<string, string> = {};
  const explicitVariableModes = node.explicitVariableModes;
  const hasExplicitVariableModes = !!explicitVariableModes && Object.keys(explicitVariableModes).length > 0;

  function record(penpotProperty: string, tokenType: TokenType, alias: VariableAlias | VariableAlias[] | undefined): void {
    const single = applyToken(appliedTokens, registry, penpotProperty, tokenType, alias);
    if (!single || !hasExplicitVariableModes) {
      return;
    }

    const defaultValue = registry.getVariableDefaultValueForBinding(single.id, tokenType, explicitVariableModes);
    if (defaultValue !== undefined) {
      writeOverride(penpotNode, penpotProperty, defaultValue);
    }
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

  if (hasExplicitVariableModes && !hasWarnedExplicitVariableModes) {
    hasWarnedExplicitVariableModes = true;

    console.warn(
      `at least one Figma node (for example "${node.name}") sets a per-frame variable mode override which Penpot cannot honour (theme switching is document-wide). figpot rewrites the bound shape values to the variable's default-mode value so the initial rendering matches Penpot's active theme — the per-frame override is therefore lost`
    );
  }

  return Object.keys(appliedTokens).length > 0 ? { appliedTokens: appliedTokens } : {};
}
