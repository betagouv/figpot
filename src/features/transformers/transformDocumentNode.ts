import assert from 'assert';

import { GetFileResponse } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { FigmaDefinedColor, FigmaDefinedTypography } from '@figpot/src/features/figma';
import { transformPageNode } from '@figpot/src/features/transformers/transformPageNode';
import { translateColor } from '@figpot/src/features/translators/translateColor';
import { translateComponentId, translateId, translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { translateTypography } from '@figpot/src/features/translators/translateTypography';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
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

  const penpotPagesNodes = figmaNode.document.children.map((child) => {
    const pageRegistry = registry.newPage(child.id);

    return transformPageNode(pageRegistry, child);
  });

  return {
    name: figmaNode.name,
    data: {
      pages: figmaNode.document.children.map((child) => translateId(child.id, registry.getMapping())),
      pagesIndex: Object.fromEntries(penpotPagesNodes.map((penpotPageNode) => [translateUuidAsObjectKey(penpotPageNode.id), penpotPageNode])),
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
      components: Object.fromEntries(
        Object.entries(figmaNode.components).map(([componentId, component]) => {
          // We do not reuse the same Figma ID because we keep it for the "transformed" frame representing the component definition
          const penpotComponentId = translateComponentId(`${componentId}_component`, mapping);
          const penpotComponentInstanceId = translateId(componentId, mapping);

          // In case of a components group since there is no equivalent into Penpot, we prepend the group name so it's under a group
          const componentName = component.componentSetId
            ? `${figmaNode.componentSets[component.componentSetId].name} / ${component.name}`
            : component.name;

          const pathLevels = componentName.split('/').map((pathLevel) => pathLevel.trim());
          const name = pathLevels.pop();

          // The API requires to provide the page for the main instance from the normal tree, so browsing it
          let penpotComponentInstancePageId: string | null = null;
          for (const pageIndex of penpotPagesNodes) {
            for (const object of Object.values(pageIndex.objects)) {
              if (object.id === penpotComponentInstanceId) {
                penpotComponentInstancePageId = pageIndex.id;

                break;
              }
            }
          }

          assert(penpotComponentInstancePageId);

          return [
            penpotComponentId,
            {
              id: penpotComponentId,
              path: pathLevels.length > 0 ? pathLevels.join(' / ') : '', // We add spaces as normalized by Penpot
              name: name,
              mainInstancePage: penpotComponentInstancePageId,
              mainInstanceId: penpotComponentInstanceId,
            } as LibraryComponent,
          ];
        })
      ),
    },
  };
}
