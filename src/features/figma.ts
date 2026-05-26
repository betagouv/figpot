import { checkbox, input, select } from '@inquirer/prompts';

import {
  Effect,
  ErrorResponsePayloadWithErrorBoolean,
  GetFileNodesResponse,
  GetFileResponse,
  GetImagesResponse,
  GetLocalVariablesResponse,
  LocalVariable,
  Paint,
  RGBA,
  SubcanvasNode,
  TypeStyle,
  VariableAlias,
  getFile,
  getFileNodes,
  getImages,
  getLocalVariables,
  getProjectFiles,
  getTeamProjects,
} from '@figpot/src/clients/figma';
import { DocumentOptionsType, ExcludePatternsType, ReplaceFontPatternType } from '@figpot/src/features/document';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export type FigmaDefinedTypography = {
  id: LocalVariable['id'];
  key: LocalVariable['key'];
  name: LocalVariable['name'];
  description: LocalVariable['description'];
  value: TypeStyle;
};

export type FigmaDefinedColor = {
  id: LocalVariable['id'];
  key: LocalVariable['key'];
  name: LocalVariable['name'];
  description: LocalVariable['description'];
  value?: Paint;
};

export type FigmaDefinedEffectStyle = {
  id: LocalVariable['id'];
  key: LocalVariable['key'];
  name: LocalVariable['name'];
  description: LocalVariable['description'];
  effects: Effect[];
};

export function processDocumentsParametersFromInput(parameters: string[]): DocumentOptionsType[] {
  return parameters.map((parameter) => {
    const parts = parameter.split(':');

    return {
      figmaDocument: parts[0],
      penpotDocument: parts[1], // May be undefined if the user wants a new Penpot document
    };
  });
}

// Figma gateway has a URL length limit, so a long list of IDs passed as a query parameter must be split
// across several requests. `baseUrl` is the request URL without the IDs, used to compute the room left.
// Ref: https://stackoverflow.com/a/40250849/3608410
function chunkIdsForUrlLength(ids: string[], baseUrl: string): string[][] {
  const urlLengthLimitBytes = 8_192;
  const remainingBytesPerRequest = urlLengthLimitBytes - baseUrl.length - 10; // We add a safe margin of 10 in case of specific default adding

  // [IMPORTANT] The generated Figma client encodes all query parameters so we account for that for `:` and `,`
  const delimiterLength = encodeURIComponent(',').length;

  const chunks: string[][] = [[]];
  let currentChunkIndex = 0;
  let currentChunkCount = 0;
  for (const id of ids) {
    const encodedIdLength = encodeURIComponent(id).length;

    // Take into account the `,` delimiter
    if (currentChunkCount + Math.max(chunks[currentChunkIndex].length - 1, 0) * delimiterLength + encodedIdLength > remainingBytesPerRequest) {
      chunks.push([]);
      currentChunkIndex++;
      currentChunkCount = 0;
    }

    chunks[currentChunkIndex].push(id);
    currentChunkCount += encodedIdLength;
  }

  return chunks;
}

export async function retrieveStylesNodes(documentId: string, stylesIds: string[]): Promise<GetFileNodesResponse['nodes']> {
  if (!stylesIds.length) {
    return {};
  }

  const nodes: GetFileNodesResponse['nodes'] = {};

  // Note: styles types `GRID` and `EFFECT` are most of the time a few, so no removing them for retrieval for future use
  const chunks = chunkIdsForUrlLength(stylesIds, `https://api.figma.com/v1/files/${documentId}/nodes?depth=1&ids=`);

  for (const stylesIds of chunks) {
    const response = await getFileNodes({
      fileKey: documentId,
      ids: stylesIds.join(','),
      depth: 1, // Should only return styles but just in case...
    });

    // Merge nodes objects
    Object.assign(nodes, response.nodes);
  }

  return nodes;
}

// Figma "text on a path" (TEXT_PATH) has no Penpot equivalent, so each one is rendered as an SVG (glyphs
// outlined) to be rebuilt as a Penpot `path`. Returns a map of node id to the rendered SVG URL.
export async function retrieveTextPathImages(documentId: string, textPathNodeIds: string[]): Promise<GetImagesResponse['images']> {
  const images: GetImagesResponse['images'] = {};

  if (!textPathNodeIds.length) {
    return images;
  }

  const chunks = chunkIdsForUrlLength(
    textPathNodeIds,
    `https://api.figma.com/v1/images/${documentId}?format=svg&svg_outline_text=true&use_absolute_bounds=true&ids=`
  );

  for (const nodeIds of chunks) {
    const response = await getImages({
      fileKey: documentId,
      ids: nodeIds.join(','),
      format: 'svg',
      svgOutlineText: true,
      useAbsoluteBounds: true,
    });

    // Merge image maps
    Object.assign(images, response.images);
  }

  return images;
}

export async function retrieveVariables(documentId: string): Promise<GetLocalVariablesResponse['meta']> {
  try {
    const localVariablesResult = await getLocalVariables({ fileKey: documentId });

    return localVariablesResult.meta;
  } catch (error) {
    const body = (error as unknown as any).body as ErrorResponsePayloadWithErrorBoolean;
    const lowerMessage = body.message.toLowerCase();

    if (body.status === 403) {
      if (lowerMessage.includes('file_variables:read')) {
        console.warn(`"file_variables:read" scope is missing from the Figma access token used`);
      } else if (lowerMessage.includes('limited by figma plan')) {
        console.warn(`design tokens won't be transferred since Figma exposes variables through the API only on its Enterprise plan`);
      } else {
        // Figma rephrases scope/plan errors over time; warn generically so a new wording does not silently turn into "no tokens".
        console.warn(`design tokens won't be transferred: Figma returned 403 on variables — ${body.message}`);
      }

      return { variables: {}, variableCollections: {} };
    }

    throw error;
  }
}

export function mergeStylesColors(colors: FigmaDefinedColor[], documentTree: GetFileResponse, stylesNodes: GetFileNodesResponse['nodes']) {
  for (const [, styleNode] of Object.entries(stylesNodes)) {
    if (documentTree.styles[styleNode.document.id]?.styleType === 'FILL' && styleNode.document.type === 'RECTANGLE') {
      // A Figma style can contains multiple colors so we have to split them to fit with the Penpot logic of "1 style = 1 color"
      for (let i = 0; i < styleNode.document.fills.length; i++) {
        colors.push({
          id: styleNode.document.fills.length > 1 ? `${styleNode.document.id}_${i}` : styleNode.document.id, // Add a suffix to differentiate them if needed
          key: documentTree.styles[styleNode.document.id].key,
          name:
            styleNode.document.fills.length > 1
              ? `${documentTree.styles[styleNode.document.id].name} ${i + 1}`
              : documentTree.styles[styleNode.document.id].name,
          description: documentTree.styles[styleNode.document.id].description,
          value: styleNode.document.fills[i],
        });
      }
    }
  }
}

export function extractStylesTypographies(documentTree: GetFileResponse, stylesNodes: GetFileNodesResponse['nodes']): FigmaDefinedTypography[] {
  const typographies: FigmaDefinedTypography[] = [];

  for (const [, styleNode] of Object.entries(stylesNodes)) {
    if (documentTree.styles[styleNode.document.id]?.styleType === 'TEXT' && styleNode.document.type === 'TEXT') {
      typographies.push({
        id: styleNode.document.id,
        key: documentTree.styles[styleNode.document.id].key,
        name: documentTree.styles[styleNode.document.id].name,
        description: documentTree.styles[styleNode.document.id].description,
        value: styleNode.document.style,
      });
    }
  }

  return typographies;
}

export function extractStylesEffects(documentTree: GetFileResponse, stylesNodes: GetFileNodesResponse['nodes']): FigmaDefinedEffectStyle[] {
  const effectStyles: FigmaDefinedEffectStyle[] = [];

  for (const [, styleNode] of Object.entries(stylesNodes)) {
    const style = documentTree.styles[styleNode.document.id];

    if (style?.styleType === 'EFFECT' && 'effects' in styleNode.document) {
      effectStyles.push({
        id: styleNode.document.id,
        key: style.key,
        name: style.name,
        description: style.description,
        effects: styleNode.document.effects,
      });
    }
  }

  return effectStyles;
}

export function countNestedTreeElements(figmaNode: SubcanvasNode): number {
  let childrenCount = 0;

  // Deep parse
  if ('children' in figmaNode) {
    childrenCount += figmaNode.children.length;

    for (const childNode of figmaNode.children) {
      childrenCount += countNestedTreeElements(childNode);
    }
  }

  return childrenCount;
}

export function countTotalElements(tree: GetFileResponse, colors: FigmaDefinedColor[], typographies: FigmaDefinedTypography[]): number {
  let treeCount = tree.document.children.length;

  for (const canvas of tree.document.children) {
    treeCount += canvas.children.length;

    for (const node of canvas.children) {
      treeCount += countNestedTreeElements(node);
    }
  }

  return treeCount + colors.length + typographies.length;
}

export function collectTextPathNodeIds(tree: GetFileResponse): string[] {
  const textPathNodeIds: string[] = [];

  function deepCollect(figmaNode: SubcanvasNode) {
    if (figmaNode.type === 'TEXT_PATH') {
      // A non-empty `fillGeometry` means the Figma API corrupted this TEXT_PATH: it returns the path circle
      // instead of the outlined text. Its SVG render is meaningless, so we neither fetch nor cache it (the
      // transform step skips such nodes too) — that way a missing local SVG always means "nothing usable".
      if (!figmaNode.fillGeometry || figmaNode.fillGeometry.length === 0) {
        textPathNodeIds.push(figmaNode.id);
      }
    }

    if ('children' in figmaNode) {
      for (const childNode of figmaNode.children) {
        deepCollect(childNode);
      }
    }
  }

  for (const canvas of tree.document.children) {
    for (const node of canvas.children) {
      deepCollect(node);
    }
  }

  return textPathNodeIds;
}

// Reverse of the suffix→weight table in `translateFontWeight`: given a weight + style, produce a PostScript suffix that `extractFontFamilySuffix` will recognize
const FONT_WEIGHT_POST_SCRIPT_SUFFIX: Record<number, { normal: string; italic: string }> = {
  100: { normal: 'Thin', italic: 'ThinItalic' },
  200: { normal: 'ExtraLight', italic: 'ExtraLightItalic' },
  300: { normal: 'Light', italic: 'LightItalic' },
  400: { normal: 'Regular', italic: 'Italic' },
  500: { normal: 'Medium', italic: 'MediumItalic' },
  600: { normal: 'SemiBold', italic: 'SemiBoldItalic' },
  700: { normal: 'Bold', italic: 'BoldItalic' },
  800: { normal: 'ExtraBold', italic: 'ExtraBoldItalic' },
  900: { normal: 'Black', italic: 'BlackItalic' },
};

export function patchFontFamily(fontSettings: TypeStyle, replaceFontPatterns: ReplaceFontPatternType[]) {
  if (!fontSettings.fontFamily) {
    return;
  }

  for (const replaceFontPattern of replaceFontPatterns) {
    // Test against both fontFamily and fontPostScriptName so users can target either side (Figma sometimes exposes the variant name only via the PostScript field)
    const matchesFamily = replaceFontPattern.search.test(fontSettings.fontFamily);
    const matchesPostScript = !!fontSettings.fontPostScriptName && replaceFontPattern.search.test(fontSettings.fontPostScriptName);
    if (!matchesFamily && !matchesPostScript) {
      continue;
    }

    fontSettings.fontFamily = replaceFontPattern.set;

    // Allow forcing a weight/style so a Figma single-weight variant (e.g. "Arial-Black" at 900) can land on a differently-registered Penpot font (e.g. "Arial Black" at 400)
    if (replaceFontPattern.setStyle !== undefined) {
      fontSettings.italic = replaceFontPattern.setStyle === 'italic';
    }
    if (replaceFontPattern.setWeight !== undefined) {
      fontSettings.fontWeight = replaceFontPattern.setWeight;
      // `translateFontWeight` ignores `fontWeight` and derives the weight from the PostScript suffix, so we also synthesize a PostScript name whose suffix maps back to the forced weight
      const postScriptSuffix = FONT_WEIGHT_POST_SCRIPT_SUFFIX[replaceFontPattern.setWeight]?.[fontSettings.italic === true ? 'italic' : 'normal'];
      if (postScriptSuffix) {
        fontSettings.fontPostScriptName = postScriptSuffix;
      }
    }

    return;
  }
}

export function patchNestedTreeElements(
  figmaNode: SubcanvasNode,
  excludePatterns: ExcludePatternsType,
  replaceFontPatterns: ReplaceFontPatternType[]
) {
  // Deep parse
  // Note: arrays are browsed the reverse order since modifying it while browsing
  if ('children' in figmaNode) {
    let w = figmaNode.children.length;
    while (w--) {
      if (excludePatterns.nodeNamePatterns && excludePatterns.nodeNamePatterns.some((pattern) => pattern.test(figmaNode.children[w].name))) {
        figmaNode.children.splice(w, 1);
      } else {
        patchNestedTreeElements(figmaNode.children[w], excludePatterns, replaceFontPatterns);
      }
    }
  }

  // Patch the font if needed
  if (figmaNode.type === 'TEXT' && replaceFontPatterns.length > 0) {
    patchFontFamily(figmaNode.style, replaceFontPatterns);

    for (const segmentStyle of Object.values(figmaNode.styleOverrideTable)) {
      patchFontFamily(segmentStyle, replaceFontPatterns);
    }
  }
}

export function patchDocument(
  documentTree: GetFileResponse,
  definedColors: FigmaDefinedColor[],
  definedTypographies: FigmaDefinedTypography[],
  excludePatterns: ExcludePatternsType,
  replaceFontPatterns: ReplaceFontPatternType[]
) {
  // Here we apply `excludePatterns` settings
  // Note: arrays are browsed the reverse order since modifying it while browsing
  let v = documentTree.document.children.length;
  while (v--) {
    const canvas = documentTree.document.children[v];

    if (excludePatterns.pageNamePatterns && excludePatterns.pageNamePatterns.some((pattern) => pattern.test(canvas.name))) {
      documentTree.document.children.splice(v, 1);
    } else {
      let w = canvas.children.length;
      while (w--) {
        if (excludePatterns.nodeNamePatterns && excludePatterns.nodeNamePatterns.some((pattern) => pattern.test(canvas.children[w].name))) {
          canvas.children.splice(w, 1);
        } else {
          patchNestedTreeElements(canvas.children[w], excludePatterns, replaceFontPatterns);
        }
      }
    }
  }

  if (excludePatterns.componentNamePatterns) {
    for (const [componentId, component] of Object.entries(documentTree.components)) {
      if (excludePatterns.componentNamePatterns.some((pattern) => pattern.test(component.name))) {
        delete documentTree.components[componentId];
      }
    }

    for (const [componentSetId, componentSet] of Object.entries(documentTree.componentSets)) {
      if (excludePatterns.componentNamePatterns.some((pattern) => pattern.test(componentSet.name))) {
        delete documentTree.componentSets[componentSetId];
      }
    }
  }

  if (excludePatterns.typographyNamePatterns) {
    let i = definedTypographies.length;
    while (i--) {
      if (excludePatterns.typographyNamePatterns.some((pattern) => pattern.test(definedTypographies[i].name))) {
        definedTypographies.splice(i, 1);
      }
    }
  }

  if (excludePatterns.colorNamePatterns) {
    let u = definedColors.length;
    while (u--) {
      if (excludePatterns.colorNamePatterns.some((pattern) => pattern.test(definedColors[u].name))) {
        definedColors.splice(u, 1);
      }
    }
  }

  // Patch the fonts if needed
  if (replaceFontPatterns.length > 0) {
    for (const definedTypography of definedTypographies) {
      patchFontFamily(definedTypography.value, replaceFontPatterns);
    }
  }
}

export async function retrieveDocument(documentId: string) {
  const documentTree = await getFile({
    fileKey: documentId,
    geometry: 'paths', // Needed to have all properties into nodes
  });

  // TODO: return the metadata

  return documentTree;
}

export async function retrieveDocumentsFromInput(): Promise<string[]> {
  // Teams cannot be gotten so expecting the user to precise it
  const teamId = await input({ message: 'What is the team ID to list the documents from? (you can see it inside the URL once on Figma)' });
  const teamAndProjects = await getTeamProjects({ teamId: teamId });

  const projectId = await select({
    message: `Inside the team "${teamAndProjects.name}", select the project to list documents from`,
    choices: teamAndProjects.projects.map((project) => {
      return {
        name: project.name,
        value: project.id,
        description: `(${project.id})`,
      };
    }),
  });

  const project = teamAndProjects.projects.find((p) => p.id === projectId);
  assert(project);

  const projectAndFiles = await getProjectFiles({ projectId: projectId });

  const documentsKeys = await checkbox({
    message: `Inside the project "${project.name}", select the documents to synchronize into Penpot`,
    choices: projectAndFiles.files.map((file) => {
      return {
        name: file.name,
        value: file.key,
        description: `(${file.key})`,
      };
    }),
  });

  if (!documentsKeys.length) {
    throw new Error('you should have selected at least a document');
  }

  return documentsKeys;
}
