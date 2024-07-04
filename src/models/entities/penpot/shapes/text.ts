import { LayoutChildAttributes } from '@figpot/src/models/entities/penpot/layout';
import { ShapeAttributes, ShapeBaseAttributes, ShapeGeomAttributes } from '@figpot/src/models/entities/penpot/shape';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';

export type TextVerticalAlign = 'top' | 'bottom' | 'center';
export type TextHorizontalAlign = 'left' | 'right' | 'center' | 'justify';
export type TextFontStyle = 'normal' | 'italic';

export type ParagraphSet = {
  type: 'paragraph-set';
  key?: string;
  children: Paragraph[];
};

export type Paragraph = {
  type: 'paragraph';
  key?: string;
  children: TextNode[];
} & TextStyle;

export type TextNode = {
  text: string;
  key?: string;
} & TextStyle;

export type FontId = {
  fontId?: string;
  fontVariantId?: string;
};

export type TextTypography = FontId & {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: TextFontStyle;
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: string;
};

export type TextStyle = TextTypography & {
  textDecoration?: string;
  direction?: string;
  typographyRefId?: string | null;
  typographyRefFile?: string | null;
  textAlign?: TextHorizontalAlign;
  textDirection?: 'ltr' | 'rtl' | 'auto';
  fills?: Fill[];
};

export type TextContent = {
  type: 'root';
  key?: string;
  verticalAlign?: TextVerticalAlign;
  children?: ParagraphSet[];
};

export type TextAttributes = {
  type?: 'text';
  content?: TextContent;
  positionData?: unknown[];
};

export type TextShape = ShapeBaseAttributes & ShapeGeomAttributes & ShapeAttributes & TextAttributes & LayoutChildAttributes;
