// Exports every variable a Figma file can resolve, library ones included, in the format of the REST
// `GET /v1/files/:key/variables/local` response (`meta`). The REST endpoint only describes the remote
// variables bound to some nodes: it misses the library collections a file only sets a mode of
// (`explicitVariableModes`) and the targets of aliases, whereas the Plugin API resolves them from the
// copies the file keeps. figpot reads the result with `--extra-variables <figmaId>:<path>`.

async function collectCollectionIds() {
  const collectionIds = new Set();
  const variableIds = new Set();

  for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
    collectionIds.add(collection.id);
  }

  const addBound = (bound) => {
    if (!bound) {
      return;
    }
    if (Array.isArray(bound)) {
      bound.forEach(addBound);
    } else if (bound.type === 'VARIABLE_ALIAS') {
      variableIds.add(bound.id);
    } else if (typeof bound === 'object') {
      Object.values(bound).forEach(addBound);
    }
  };

  await figma.loadAllPagesAsync();
  figma.ui.postMessage({ type: 'progress', text: 'Walking the nodes…' });

  for (const page of figma.root.children) {
    addBound(page.boundVariables);
    Object.keys(page.explicitVariableModes || {}).forEach((id) => collectionIds.add(id));

    page.findAll((node) => {
      if ('explicitVariableModes' in node) {
        Object.keys(node.explicitVariableModes).forEach((id) => collectionIds.add(id));
      }
      if ('boundVariables' in node) {
        addBound(node.boundVariables);
      }
      for (const key of ['fills', 'strokes', 'effects', 'layoutGrids']) {
        if (key in node && Array.isArray(node[key])) {
          node[key].forEach((item) => addBound(item.boundVariables));
        }
      }
      return false;
    });
  }

  for (const style of [
    ...(await figma.getLocalPaintStylesAsync()),
    ...(await figma.getLocalTextStylesAsync()),
    ...(await figma.getLocalEffectStylesAsync()),
    ...(await figma.getLocalGridStylesAsync()),
  ]) {
    addBound(style.boundVariables);
    if ('paints' in style) {
      style.paints.forEach((paint) => addBound(paint.boundVariables));
    }
  }

  return { collectionIds, variableIds };
}

function serializeCollection(collection) {
  const serialized = {
    id: collection.id,
    name: collection.name,
    key: collection.key,
    modes: collection.modes.map((mode) => ({ modeId: mode.modeId, name: mode.name })),
    defaultModeId: collection.defaultModeId,
    remote: collection.remote,
    hiddenFromPublishing: collection.hiddenFromPublishing,
    variableIds: [...collection.variableIds],
  };

  if (collection.isExtension) {
    serialized.isExtension = true;
    serialized.parentVariableCollectionId = collection.parentVariableCollectionId;
    serialized.variableOverrides = collection.variableOverrides;
  }

  return serialized;
}

function serializeVariable(variable) {
  return {
    id: variable.id,
    name: variable.name,
    key: variable.key,
    variableCollectionId: variable.variableCollectionId,
    resolvedType: variable.resolvedType,
    valuesByMode: variable.valuesByMode,
    remote: variable.remote,
    description: variable.description,
    hiddenFromPublishing: variable.hiddenFromPublishing,
    scopes: variable.scopes,
    codeSyntax: variable.codeSyntax,
  };
}

async function exportVariables() {
  const { collectionIds, variableIds } = await collectCollectionIds();

  const variableCollections = {};
  const variables = {};
  const pendingCollections = [...collectionIds];
  const pendingVariables = [...variableIds];
  const missing = [];

  // Breadth-first over collections and variables: a collection brings its variables, a variable its
  // collection and the targets of its aliases, an extension its parent
  while (pendingCollections.length > 0 || pendingVariables.length > 0) {
    while (pendingCollections.length > 0) {
      const id = pendingCollections.pop();
      if (variableCollections[id]) {
        continue;
      }

      const collection = await figma.variables.getVariableCollectionByIdAsync(id);
      if (!collection) {
        missing.push(id);
        continue;
      }

      variableCollections[id] = serializeCollection(collection);
      pendingVariables.push(...collection.variableIds);
      if (collection.isExtension) {
        pendingCollections.push(collection.parentVariableCollectionId);
      }
    }

    while (pendingVariables.length > 0) {
      const id = pendingVariables.pop();
      if (variables[id]) {
        continue;
      }

      const variable = await figma.variables.getVariableByIdAsync(id);
      if (!variable) {
        missing.push(id);
        continue;
      }

      variables[id] = serializeVariable(variable);
      if (!variableCollections[variable.variableCollectionId]) {
        pendingCollections.push(variable.variableCollectionId);
      }
      for (const value of Object.values(variable.valuesByMode)) {
        if (value && value.type === 'VARIABLE_ALIAS' && !variables[value.id]) {
          pendingVariables.push(value.id);
        }
      }
    }

    figma.ui.postMessage({
      type: 'progress',
      text: `${Object.keys(variableCollections).length} collections, ${Object.keys(variables).length} variables…`,
    });
  }

  return { variableCollections, variables, missing };
}

figma.showUI(__html__, { width: 360, height: 200 });

exportVariables()
  .then(({ variableCollections, variables, missing }) => {
    figma.ui.postMessage({
      type: 'done',
      fileName: `${figma.root.name}.variables.json`,
      json: JSON.stringify({ meta: { variableCollections, variables } }),
      summary:
        `${Object.keys(variableCollections).length} collections, ${Object.keys(variables).length} variables` +
        (missing.length > 0 ? `, ${missing.length} unresolved ids` : ''),
    });
  })
  .catch((error) => {
    figma.ui.postMessage({ type: 'error', text: String(error) });
  });
