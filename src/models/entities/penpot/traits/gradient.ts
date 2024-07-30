export const LINEAR_TYPE: unique symbol = Symbol.for('linear');
export const RADIAL_TYPE: unique symbol = Symbol.for('radial');

type GradientStop = {
  color: string;
  opacity?: number;
  offset: number;
  id?: string;
  fileId?: string;
};

export type Gradient = {
  type: 'linear' | 'radial' | typeof LINEAR_TYPE | typeof RADIAL_TYPE; // symbol
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  stops: GradientStop[];
};
