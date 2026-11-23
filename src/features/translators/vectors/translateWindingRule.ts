import { Path } from '@figpot/src/clients/figma';
import { FillRules } from '@figpot/src/models/entities/penpot/shapes/path';

export function translateWindingRule(windingRule: Path['windingRule'] | 'NONE'): FillRules | undefined {
  switch (windingRule) {
    case 'EVENODD':
      return 'evenodd';
    case 'NONZERO':
      return 'nonzero';
  }
}
