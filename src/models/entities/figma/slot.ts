import { FrameTraits, SubcanvasNode } from '@figpot/src/clients/figma';

// Figma's `SLOT` node (a component slot holding the slotted instances) is returned by the REST API but is
// missing from their OpenAPI spec, so it is absent from the generated client types. Structurally it is a
// frame (a container of children with its own layout), so we model it exactly like `FrameNode`/`GroupNode`:
// the same `FrameTraits` plus its own `type` literal.
export type SlotNode = {
  type: 'SLOT';
} & FrameTraits;

// `SubcanvasNode` widened with `SlotNode`, so the scene-node transformer can branch on `SLOT` without a cast.
export type SubcanvasNodeWithSlot = SubcanvasNode | SlotNode;
