import { BuildContext, createBuildContext } from '@penpot/library';
import svgPathParser from 'svg-path-parser';

import { Transform } from '@figpot/src/clients/figma';
import { translateTransformedCommands } from '@figpot/src/features/translators/vectors/translateCommands';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { BoolContent, BoolOperations } from '@figpot/src/models/entities/penpot/shapes/bool';

const { parseSVG } = svgPathParser;

const IDENTITY_TRANSFORM: Transform = [
  [1, 0, 0],
  [0, 1, 0],
];

// The geometry Penpot reads from a rectangle or an ellipse to turn it into a path (the corner radiuses for a rectangle)
function pickGeometry(node: PenpotNode) {
  const { name, hidden, x, y, width, height, rotation, transform, transformInverse, selrect, points, r1, r2, r3, r4 } = node as PenpotNode & {
    x: number;
    y: number;
    width: number;
    height: number;
    r1?: number;
    r2?: number;
    r3?: number;
    r4?: number;
  };

  return { name, hidden, x, y, width, height, rotation, transform, transformInverse, selrect, points, r1, r2, r3, r4 };
}

/**
 * Adds an operand to the boolean being built, as Penpot would combine it. Returns false for a shape Penpot cannot combine
 * from the data figpot has (a text, a board...)
 */
function addOperand(context: BuildContext, node: PenpotNode, getNode: (id: string) => PenpotNode | undefined): boolean {
  switch (node.type) {
    case 'path':
    case 'bool':
      context.addPath({ name: node.name, hidden: node.hidden, content: node.content });

      return true;
    case 'rect':
      context.addRect(pickGeometry(node));

      return true;
    case 'circle':
      context.addCircle(pickGeometry(node));

      return true;
    case 'group': {
      context.addGroup({ name: node.name, hidden: node.hidden });

      const added = (node.shapes ?? []).every((childId) => {
        const child = getNode(childId);

        return child !== undefined && addOperand(context, child, getNode);
      });

      context.closeGroup();

      return added;
    }
    default:
      return false;
  }
}

/**
 * The content of a boolean computed from its operands by the Penpot library, so exactly as Penpot computes it when a
 * boolean is created or edited. For booleans Figma gives no geometry of (layers of instances of a library the token cannot
 * read), which Penpot would otherwise render empty, and hiding everything as a mask.
 *
 * Returns `undefined` when an operand cannot be combined, and throws when the library rejects them
 */
export function computeBoolContent(
  boolType: BoolOperations,
  operandIds: string[],
  getNode: (id: string) => PenpotNode | undefined
): BoolContent[] | undefined {
  const operands = operandIds.map(getNode);
  if (operands.length === 0 || operands.some((operand) => operand === undefined)) {
    return undefined;
  }

  const context = createBuildContext();
  context.addFile({ name: 'boolean' });
  context.addPage({ name: 'boolean' });

  const groupId = context.addGroup({ name: 'operands' });
  const added = (operands as PenpotNode[]).every((operand) => addOperand(context, operand, getNode));
  context.closeGroup();

  if (!added) {
    return undefined;
  }

  const boolId = context.addBool({ groupId, type: typeof boolType === 'symbol' ? (Symbol.keyFor(boolType) as string) : boolType });

  const state = context.getInternalState();
  const [page] = Object.values(state.files[state.currentFileId].data.pagesIndex);
  const content = page.objects[boolId].content ?? '';

  // Penpot gives the path in absolute coordinates, as the boolean content
  return translateTransformedCommands(parseSVG(content), IDENTITY_TRANSFORM);
}
