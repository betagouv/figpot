import { GetFileResponse } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { FigmaDefinedColor, FigmaDefinedTypography } from '@figpot/src/features/figma';
import { transformPageNode } from '@figpot/src/features/transformers/transformPageNode';
import { translateColor } from '@figpot/src/features/translators/translateColor';
import { translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { translateTypography } from '@figpot/src/features/translators/translateTypography';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { Registry } from '@figpot/src/models/entities/registry';

export function transformDocumentNode(
  figmaNode: GetFileResponse,
  figmaDefinedColors: FigmaDefinedColor[],
  figmaDefinedTypographies: FigmaDefinedTypography[],
  mapping: MappingType
): PenpotDocument {
  // We use `GetFileResponse` type instead of the type `DocumentNode` to have the "document" title

  const registry = new Registry(mapping);

  for (const figmaDefinedColor of figmaDefinedColors) {
    registry.addColor(translateColor(registry, figmaDefinedColor));
  }

  for (const figmaDefinedTypography of figmaDefinedTypographies) {
    registry.addTypography(translateTypography(registry, figmaDefinedTypography));
  }

  return {
    name: figmaNode.name,
    data: {
      pagesIndex: Object.fromEntries(
        figmaNode.document.children.map((child) => {
          const pageRegistry = registry.newPage(child.id);
          const penpotNode = transformPageNode(pageRegistry, child);

          return [translateUuidAsObjectKey(penpotNode.id), penpotNode];
        })
      ),
      colors: Object.fromEntries(
        Array.from(registry.getColors()).map(([penpotColorId, penpotColor]) => {
          return [translateUuidAsObjectKey(penpotColorId), penpotColor];
        })
      ),
      typographies: Object.fromEntries(
        Array.from(registry.getTypographies()).map(([penpotTypographyId, penpotTypography]) => {
          return [translateUuidAsObjectKey(penpotTypographyId), penpotTypography];
        })
      ),
    },
  };
}
