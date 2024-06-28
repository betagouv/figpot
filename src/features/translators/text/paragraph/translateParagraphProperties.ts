import { TypePropertiesTrait } from '@figpot/src/clients/figma';

export type TextSegment = Pick<TypePropertiesTrait, 'characters' | 'style' | 'lineTypes' | 'lineIndentations'>;
