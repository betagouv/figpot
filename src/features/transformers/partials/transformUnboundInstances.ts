import { nullId } from '@figpot/src/features/translators/translateId';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';

// Instances whose component cannot be bound (library skipped or component not published) are emitted with null
// references, but their descendants still reference the shapes of the original component. Penpot then considers them as
// component copies and flags their geometry as `touched` on every update, so they would never be in sync. Making the whole
// subtree plain shapes keeps the same rendering without any reference to a component that does not exist
// Note: nested instances are detached too, since Penpot only allows nested copies inside a copy (their references are
// relative to the parent component, so they cannot become standalone copies without recomputing them)
export function transformUnboundInstances(page: PenpotPage): void {
  const detach = (node: PenpotNode) => {
    delete node.componentId;
    delete node.componentFile;
    delete node.componentRoot;
    delete node.shapeRef;
    delete node.touched;

    if ('shapes' in node && Array.isArray(node.shapes)) {
      for (const childId of node.shapes) {
        const child = page.objects[childId];

        if (child) {
          detach(child);
        }
      }
    }
  };

  for (const node of Object.values(page.objects)) {
    if (node.componentId === nullId) {
      detach(node);
    }
  }
}
