// Penpot design token types, mirroring the `set-token`/`set-token-set`/`set-token-theme` operations.
//
// Penpot accepts these as **camelCase** strings on the JSON wire even though the underlying Clojure
// keyword is kebab-case (e.g. `:border-radius`) — its `:decode/json` converts `borderRadius` to
// `:border-radius` server-side. Sending the kebab string directly is rejected with `:value nil`
// (the validator decodes to nil and then fails the enum check), so we keep camelCase end-to-end.
export type TokenType =
  | 'sizing'
  | 'rotation'
  | 'color'
  | 'number'
  | 'fontSize'
  | 'fontWeight'
  | 'textCase'
  | 'other'
  | 'string'
  | 'dimensions'
  | 'borderWidth'
  | 'opacity'
  | 'typography'
  | 'textDecoration'
  | 'letterSpacing'
  | 'shadow'
  | 'borderRadius'
  | 'boolean'
  | 'fontFamily'
  | 'spacing';

// value of a `shadow` token (Figma effect style)
export type ShadowTokenValue = {
  color: string;
  x: string;
  y: string;
  blur: string;
  spread: string;
  inset: boolean;
};

export type Token = {
  id: string;
  name: string;
  type: TokenType;
  value: string | string[] | ShadowTokenValue[];
  description?: string;
};

// doing our best to make a bridge between figma and penpot, so this represents just one collection mode within figma
export type TokenSet = {
  id: string;
  name: string;
  description?: string;
  tokens: Record<string, Token>; // keyed by token name
};

export type TokenTheme = {
  id: string;
  name: string; // corresponding to figma collection mode
  group: string; // corresponding to figma collection name
  description?: string;
  isSource?: boolean;
  sets: string[];
};
