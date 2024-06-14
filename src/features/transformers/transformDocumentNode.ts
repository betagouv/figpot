import { GetFileResponse } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { transformPageNode } from '@figpot/src/features/transformers/transformPageNode';
import { translateUuidAsObjectKey } from '@figpot/src/features/translators/translateId';
import { PenpotDocument } from '@figpot/src/models/entities/penpot/document';

export function transformDocumentNode(figmaNode: GetFileResponse, mapping: MappingType): PenpotDocument {
  // We use `GetFileResponse` type instead of the type `DocumentNode` to have the "document" title
  return {
    name: figmaNode.name,
    data: {
      pagesIndex: Object.fromEntries(
        figmaNode.document.children.map((child) => {
          const penpotNode = transformPageNode(child, mapping);

          return [translateUuidAsObjectKey(penpotNode.id), penpotNode];
        })
      ),
    },
  };
}
