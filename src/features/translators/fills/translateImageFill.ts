import assert from 'assert';
import { globSync } from 'glob';
import sizeOf from 'image-size';

import { ImagePaint } from '@figpot/src/clients/figma';
import { MappingType, getFigmaMediaPath } from '@figpot/src/features/document';
import { translateOpacityWithVisibility } from '@figpot/src/features/translators/fills/translateOpacity';
import { translateMediaId } from '@figpot/src/features/translators/translateId';
import { Fill } from '@figpot/src/models/entities/penpot/traits/fill';

export function translateImageFill(fill: ImagePaint, mapping: MappingType): Fill | undefined {
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

  return {
    fillOpacity: translateOpacityWithVisibility(fill),
    fillImage: {
      id: translateMediaId(fill.imageRef, mapping),
      width: dimensions.width,
      height: dimensions.height,
      keepAspectRatio: true,
      // At the end the backend does not pass in getters if undefined so leaving like this with no need to clean the hosted tree for comparaison
      name: undefined, // This should be the original filename but we don't have it (we only have the container name which is probably very different), relying on the upload step name
      mtype: undefined, // The mime type is inferred at uploading step by the server so no need to complicate things here
    },
  };
}
