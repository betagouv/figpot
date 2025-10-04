import { globSync } from 'glob';
import { mimeData } from 'human-filetypes';
import sizeOf from 'image-size';
import path from 'path';

import { ImagePaint } from '@figpot/src/clients/figma';
import { getFigmaMediaPath } from '@figpot/src/features/document';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { translateMediaId } from '@figpot/src/features/translators/translateId';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';
import { BoundVariableRegistry } from '@figpot/src/models/entities/registry';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export function translateImageFill(registry: BoundVariableRegistry, fill: ImagePaint): Fill | undefined {
  // TODO: Figma supports multiple scale mode (see `scaleMode` type)
  // For now we don't process this since Penpot matches the node rectangle to the image size (except if changing the image after, which is rare)
  // Examples: when this one is `STRETCH` an image transform is provided, if `TILE` a scaling factor is provided

  // The provided size of the image must be the file dimension (the parent node will manage the display size)
  // Note: it's synchronous to not break the whole chain of nested calls, this should remain really low at cost performance, but if needed this could be retrieved before browsing and just passed at parameters
  const rootFilePath = getFigmaMediaPath(fill.imageRef);
  const filesWithExtensionPaths = globSync(`${rootFilePath}.*`);

  assert(filesWithExtensionPaths.length === 1);

  const dimensions = sizeOf(filesWithExtensionPaths[0]);

  assert(dimensions.width);
  assert(dimensions.height);

  // The new Penpot API requires specifying the MIME type even if it has been done at upload
  // It's a bit weird but ok, to avoid complex things we infer this from the extension (since we did the reverse from `Content-Type` inside `downloadFile()` to set an extension)
  const extension = path.extname(filesWithExtensionPaths[0]);

  const mimeTypeResult = Object.entries(mimeData).find(([mimeType, mimeTypeMetadata]) => {
    return mimeTypeMetadata.extensions?.includes(extension);
  });

  if (!mimeTypeResult) {
    throw new Error(`the file ${filesWithExtensionPaths[0]} saved locally should have an extension allowing us to retrieve the MIME type`);
  }

  const mimeType = mimeTypeResult[0];

  return {
    fillOpacity: translateOpacityWithVisibility(fill),
    fillImage: {
      id: translateMediaId(fill.imageRef, registry.getMapping()),
      width: dimensions.width,
      height: dimensions.height,
      keepAspectRatio: true,
      mtype: mimeType,
      // At the end the backend does not pass in getters if undefined so leaving like this with no need to clean the hosted tree for comparaison
      name: undefined, // This should be the original filename but we don't have it (we only have the container name which is probably very different), relying on the upload step name
    },
  };
}
