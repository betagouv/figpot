import { booleanOperation } from '@figpot/src/clients/figma';
import { BoolOperations } from '@figpot/src/models/entities/penpot/shapes/bool';

export function translateBoolType(booleanOperation: booleanOperation): BoolOperations {
  switch (booleanOperation) {
    case 'EXCLUDE':
      return 'exclude';
    case 'INTERSECT':
      return 'intersection';
    case 'SUBTRACT':
      return 'difference';
    case 'UNION':
      return 'union';
  }
}
