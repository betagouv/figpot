import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';

import { TypeStyle } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';

// Fixed UUID namespace used for the deterministic `uuidv5` derivations of token set / token ids.
// Tying the id to the set path / token name lets both the freshly-transformed Figma side and the
// `tokensLib`-extracted Penpot side land on the same UUID, so the diff sees existing sets and
// tokens as unchanged across syncs instead of re-emitting them every run
const TOKEN_ID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export const nullId = '00000000-0000-0000-0000-000000000000';

export const rootFrameId = '00000000-0000-0000-0000-000000000000';
export const rootFrameIdSuffix = '_rootFrame';

export function translateId(figmaNodeId: string, mapping: MappingType): string {
  const penpotMappedNodeId = mapping.nodes.get(figmaNodeId);
  if (penpotMappedNodeId) {
    return penpotMappedNodeId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotNodeId = uuidv7();
  mapping.nodes.set(figmaNodeId, penpotNodeId);

  return penpotNodeId;
}

export function registerId(figmaNodeId: string, penpotNodeId: string, mapping: MappingType) {
  mapping.nodes.set(figmaNodeId, penpotNodeId);
}

export function translateMediaId(figmaMediaId: string, mapping: MappingType): string {
  const penpotMappedMediaId = mapping.assets.get(figmaMediaId);
  if (penpotMappedMediaId) {
    return penpotMappedMediaId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotMediaId = uuidv7();
  mapping.assets.set(figmaMediaId, penpotMediaId);

  return penpotMediaId;
}

export function translateFontId(simulatedFigmaFontVariantId: string, fontName: TypeStyle, mapping: MappingType): string {
  const penpotFontId = mapping.fonts.get(simulatedFigmaFontVariantId);
  if (!penpotFontId) {
    throw new Error(
      `the font variant "${fontName.fontPostScriptName}" from the font family "${fontName.fontFamily}" is missing onto the Penpot instance for your team. Please go to your dashboard and add the font manually. We advise you to upload all variants of the font for the ease. Also, note we were not able to automate this because it cannot be scoped to a file and there would be a risk of duplication due to Penpot current validation. If needed you can use a parameter to replace a font family, see our documentation`
    );
  }

  // Note: the font ID is the same no matter the variant used (light, bold...)
  return `custom-${penpotFontId}`;
}

export function registerFontId(simulatedFigmaFontVariantId: string, penpotFontId: string, mapping: MappingType) {
  mapping.fonts.set(simulatedFigmaFontVariantId, penpotFontId);
}

export function translateDocumentId(figmaDocumentId: string, mapping: MappingType): string {
  const penpotDocumentId = mapping.documents.get(figmaDocumentId);
  if (!penpotDocumentId) {
    throw new Error(`the document mapping must be registered`);
  }

  return penpotDocumentId;
}

export function registerDocumentId(figmaDocumentId: string, penpotDocumentId: string, mapping: MappingType) {
  mapping.fonts.set(figmaDocumentId, penpotDocumentId);
}

export function translateColorId(figmaColorId: string, mapping: MappingType): string {
  const penpotMappedColorId = mapping.colors.get(figmaColorId);
  if (penpotMappedColorId) {
    return penpotMappedColorId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotColorId = uuidv7();
  mapping.colors.set(figmaColorId, penpotColorId);

  return penpotColorId;
}

export function translateTypographyId(figmaTypographyId: string, mapping: MappingType): string {
  const penpotMappedTypographyId = mapping.colors.get(figmaTypographyId);
  if (penpotMappedTypographyId) {
    return penpotMappedTypographyId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotTypographyId = uuidv7();
  mapping.colors.set(figmaTypographyId, penpotTypographyId);

  return penpotTypographyId;
}

export function translateComponentId(figmaComponentId: string, mapping: MappingType): string {
  const penpotMappedComponentId = mapping.components.get(figmaComponentId);
  if (penpotMappedComponentId) {
    return penpotMappedComponentId;
  }

  // Otherwise we create a new one, adding it to the mapping object
  // Note: we use UUID v7 because Penpot seems to have one with timestamp at the beginning (even if they call if "v8", but this is to be free-form apparently)
  const penpotComponentId = uuidv7();
  mapping.components.set(figmaComponentId, penpotComponentId);

  return penpotComponentId;
}

// Token-related ids derive from the set/token path with `uuidv5`, no mapping persistence required:
// the path is a stable string both the freshly-built Figma side and the `tokensLib`-extracted
// Penpot side can produce, so the diff matches sets/tokens as unchanged across syncs. The
// `mapping` parameter is kept for signature parity with the other `translateXId` functions even
// though it goes unused
export function translateTokenSetId(setPath: string, _mapping?: MappingType): string {
  return uuidv5(`token-set/${setPath}`, TOKEN_ID_NAMESPACE);
}

export function translateTokenId(setPath: string, tokenName: string, _mapping?: MappingType): string {
  return uuidv5(`token/${setPath}/${tokenName}`, TOKEN_ID_NAMESPACE);
}

export function translateTokenThemeId(themePath: string, _mapping?: MappingType): string {
  return uuidv5(`token-theme/${themePath}`, TOKEN_ID_NAMESPACE);
}

export function formatPageRootFrameId(pageId: string) {
  return `${pageId}${rootFrameIdSuffix}`;
}

export function isPageRootFrame(partialNode: Pick<PenpotNode, 'id' | 'parentId'>): boolean {
  return partialNode.id === partialNode.parentId;
}

export function isPageRootFrameFromId(nodeId: string): boolean {
  return nodeId.endsWith(rootFrameIdSuffix);
}
