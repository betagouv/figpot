import { GetFileResponse, SubcanvasNode } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { FigmaDefinedColor, FigmaDefinedTypography } from '@figpot/src/features/figma';
import { transformPageNode } from '@figpot/src/features/transformers/transformPageNode';
import { translateColor } from '@figpot/src/features/translators/translateColor';
import { translateComponentId, translateId, translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { translateTypography } from '@figpot/src/features/translators/translateTypography';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';
import { Registry } from '@figpot/src/models/entities/registry';

export function detectLocalFigmaComponents(foundComponentsIds: string[], figmaNode: SubcanvasNode) {
  if (figmaNode.type === 'COMPONENT') {
    foundComponentsIds.push(figmaNode.id);
  }

  // Deep parse
  if ('children' in figmaNode) {
    for (const childNode of figmaNode.children) {
      detectLocalFigmaComponents(foundComponentsIds, childNode);
    }
  }
}

export function cleanFigmaDefects(figmaNode: GetFileResponse) {
  // [WORKAROUND] For whatever reason Figma may list components as being local whereas they are not (and not remote too) (maybe on old Figma files that have evolved with their internal changes)
  // We mark them as remote to adjust since it's fine with our logic with the Penpot one, but we could also try to replace `INSTANCE` by a basic frame
  // Ref: https://forum.figma.com/t/rest-api-issue-local-component-listed-but-not-existing-in-the-document-tree-but-accessible-via-node-endpoint/78294
  const foundFigmaComponentsIds: string[] = [];
  const expectedFigmaComponentsIds: string[] = Object.entries(figmaNode.components)
    .filter(([componentId, component]) => {
      return component.remote === false;
    })
    .map(([componentId, component]) => {
      return componentId;
    });

  for (const canvas of figmaNode.document.children) {
    for (const node of canvas.children) {
      detectLocalFigmaComponents(foundFigmaComponentsIds, node);
    }
  }

  const emulatedFigmaComponentsIds: string[] = [];

  // Check the difference and mark as remote if not present locally
  for (const expectedComponentId of expectedFigmaComponentsIds) {
    if (foundFigmaComponentsIds.indexOf(expectedComponentId) === -1) {
      emulatedFigmaComponentsIds.push(expectedComponentId);

      figmaNode.components[expectedComponentId].remote = true;
    }
  }

  if (emulatedFigmaComponentsIds.length > 0) {
    console.warn(
      `Figma has sent ${emulatedFigmaComponentsIds.length} local components defects, we emulated them as remote components for the ease of usage: [${emulatedFigmaComponentsIds.join(', ')}]`
    );
  }
}

export function transformDocumentNode(
  figmaNode: GetFileResponse,
  figmaDefinedColors: FigmaDefinedColor[],
  figmaDefinedTypographies: FigmaDefinedTypography[],
  mapping: MappingType
): PenpotDocument {
  // We use `GetFileResponse` type instead of the type `DocumentNode` to have the "document" title

  cleanFigmaDefects(figmaNode);

  const registry = new Registry(mapping);

  for (const figmaDefinedColor of figmaDefinedColors) {
    registry.addColor(translateColor(registry, figmaDefinedColor));
  }

  for (const figmaDefinedTypography of figmaDefinedTypographies) {
    registry.addTypography(translateTypography(registry, figmaDefinedTypography));
  }

  for (const [componentId, component] of Object.entries(figmaNode.components)) {
    // TODO: implement cross-documents bindings if needed and if Penpot does not plan to have an easy feature for this

    // Skip remote component because there are not listed at the document level, and instances have a different logic
    if (component.remote === true) {
      continue;
    }

    // We do not reuse the same Figma ID because we keep it for the "transformed" frame representing the component definition
    const penpotComponentId = translateComponentId(`${componentId}_component`, mapping);
    const penpotComponentInstanceId = translateId(componentId, mapping);

    // In case of a components group since there is no equivalent into Penpot, we prepend the group name so it's under a group
    const componentName = component.componentSetId ? `${figmaNode.componentSets[component.componentSetId].name} / ${component.name}` : component.name;

    const pathLevels = componentName.split('/').map((pathLevel) => pathLevel.trim());
    const name = pathLevels.pop();

    const penpotComponent: LibraryComponent = {
      id: penpotComponentId,
      path: pathLevels.length > 0 ? pathLevels.join(' / ') : '', // We add spaces as normalized by Penpot
      name: name,
      mainInstancePage: null, // Will be set after, once we have browsed the normal tree
      mainInstanceId: penpotComponentInstanceId,
    };

    registry.addComponent(penpotComponent);
  }

  const penpotPagesNodes = figmaNode.document.children.map((child) => {
    const pageRegistry = registry.newPage(child.id);

    return transformPageNode(pageRegistry, child);
  });

  // Patch components with the component page ID since the API requires it (it's not known at definition time)
  for (const component of registry.getComponents().values()) {
    pagesLoop: for (const pageIndex of penpotPagesNodes) {
      for (const object of Object.values(pageIndex.objects)) {
        if (object.id === component.mainInstanceId) {
          component.mainInstancePage = pageIndex.id;

          break pagesLoop;
        }
      }
    }
  }

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
        Array.from(registry.getComponents()).map(([penpotComponentId, penpotComponent]) => {
          return [translateUuidAsObjectKey(penpotComponentId), penpotComponent];
        })
      ),
    },
  };
}
