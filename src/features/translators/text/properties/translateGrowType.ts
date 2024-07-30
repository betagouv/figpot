import { TypeStyle } from '@figpot/src/clients/figma';
import { GrowType } from '@figpot/src/models/entities/penpot/shape';

export function translateGrowType(node: Pick<TypeStyle, 'textAutoResize'>): GrowType {
  // It is returned by the API but not present in the OpenAPI schema
  if ((node as any).leadingTrim === 'CAP_HEIGHT') {
    return 'fixed';
  }

  switch (node.textAutoResize) {
    case 'WIDTH_AND_HEIGHT':
      return 'auto-width';
    case 'HEIGHT':
      return 'auto-height';
    case 'TRUNCATE':
    default:
      return 'fixed';
  }
}
