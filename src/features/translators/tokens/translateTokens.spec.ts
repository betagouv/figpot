import { GetLocalVariablesResponse, LocalVariable, LocalVariableCollection } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { translateTokens } from '@figpot/src/features/translators/tokens/translateTokens';

function makeMapping(): MappingType {
  return {
    lastExport: null,
    fonts: new Map(),
    assets: new Map(),
    nodes: new Map(),
    documents: new Map(),
    colors: new Map(),
    typographies: new Map(),
    components: new Map(),
    tokenSets: new Map(),
    tokens: new Map(),
    tokenThemes: new Map(),
  };
}

function makeCollection(
  partial: Pick<LocalVariableCollection, 'id' | 'name' | 'modes' | 'defaultModeId' | 'variableIds'> & Partial<LocalVariableCollection>
): LocalVariableCollection {
  return { key: '', remote: false, hiddenFromPublishing: false, ...partial } as LocalVariableCollection;
}

function makeVariable(
  partial: Pick<LocalVariable, 'id' | 'name' | 'variableCollectionId' | 'resolvedType' | 'valuesByMode'> & Partial<LocalVariable>
): LocalVariable {
  return { key: '', remote: false, description: '', hiddenFromPublishing: false, scopes: [], codeSyntax: {}, ...partial } as LocalVariable;
}

function makeData(collections: LocalVariableCollection[], variables: LocalVariable[]): GetLocalVariablesResponse['meta'] {
  return {
    variableCollections: Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    variables: Object.fromEntries(variables.map((variable) => [variable.id, variable])),
  };
}

describe('translateTokens()', () => {
  it('translates a color variable into a color token', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'Primitives',
      defaultModeId: 'm1',
      modes: [{ modeId: 'm1', name: 'Default' }],
      variableIds: ['V1'],
    });
    const variable = makeVariable({
      id: 'V1',
      name: 'colors/brand',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { m1: { r: 1, g: 0, b: 0, a: 1 } },
    });

    const { tokenSets, tokenThemes } = translateTokens(makeData([collection], [variable]), makeMapping());

    expect(tokenSets['Primitives/Default'].tokens['colors.brand']).toMatchObject({
      name: 'colors.brand',
      type: 'color',
      value: '#ff0000',
    });
    expect(tokenThemes['Primitives/Default']).toMatchObject({ name: 'Default', group: 'Primitives', sets: ['Primitives/Default'] });
  });

  it('creates one set and one theme per collection mode', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'Theme',
      defaultModeId: 'light',
      modes: [
        { modeId: 'light', name: 'Light' },
        { modeId: 'dark', name: 'Dark' },
      ],
      variableIds: ['V1'],
    });
    const variable = makeVariable({
      id: 'V1',
      name: 'bg',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 }, dark: { r: 0, g: 0, b: 0, a: 1 } },
    });

    const { tokenSets, tokenThemes } = translateTokens(makeData([collection], [variable]), makeMapping());

    expect(Object.keys(tokenSets).sort()).toEqual(['Theme/Dark', 'Theme/Light']);
    expect(tokenSets['Theme/Light'].tokens['bg'].value).toBe('#ffffff');
    expect(tokenSets['Theme/Dark'].tokens['bg'].value).toBe('#000000');
    expect(Object.keys(tokenThemes).sort()).toEqual(['Theme/Dark', 'Theme/Light']);
  });

  it('resolves a local alias to a token reference', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'C',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['prim', 'sem'],
    });
    const primitive = makeVariable({
      id: 'prim',
      name: 'colors/blue',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { m: { r: 0, g: 0, b: 1, a: 1 } },
    });
    const semantic = makeVariable({
      id: 'sem',
      name: 'colors/primary',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { m: { type: 'VARIABLE_ALIAS', id: 'prim' } },
    });

    const { tokenSets } = translateTokens(makeData([collection], [primitive, semantic]), makeMapping());

    expect(tokenSets['C/M'].tokens['colors.primary'].value).toBe('{colors.blue}');
  });

  it('drops a token aliasing a variable from another file', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'C',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['x'],
    });
    const variable = makeVariable({
      id: 'x',
      name: 'remote',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { m: { type: 'VARIABLE_ALIAS', id: 'EXTERNAL_FILE_VARIABLE' } },
    });

    const { tokenSets } = translateTokens(makeData([collection], [variable]), makeMapping());

    expect(tokenSets['C/M'].tokens).toEqual({});
  });

  it('routes FLOAT variables to token types through their scopes', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'C',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['radius', 'gap', 'plain', 'faded'],
    });
    const variables = [
      makeVariable({
        id: 'radius',
        name: 'radius',
        variableCollectionId: 'C1',
        resolvedType: 'FLOAT',
        scopes: ['CORNER_RADIUS'],
        valuesByMode: { m: 8 },
      }),
      makeVariable({ id: 'gap', name: 'gap', variableCollectionId: 'C1', resolvedType: 'FLOAT', scopes: ['GAP'], valuesByMode: { m: 16 } }),
      makeVariable({ id: 'plain', name: 'plain', variableCollectionId: 'C1', resolvedType: 'FLOAT', scopes: [], valuesByMode: { m: 3 } }),
      makeVariable({ id: 'faded', name: 'faded', variableCollectionId: 'C1', resolvedType: 'FLOAT', scopes: ['OPACITY'], valuesByMode: { m: 50 } }),
    ];

    const { tokenSets } = translateTokens(makeData([collection], variables), makeMapping());

    expect(tokenSets['C/M'].tokens['radius']).toMatchObject({ type: 'borderRadius', value: '8' });
    expect(tokenSets['C/M'].tokens['gap']).toMatchObject({ type: 'spacing', value: '16' });
    expect(tokenSets['C/M'].tokens['plain']).toMatchObject({ type: 'number', value: '3' });
    // Figma stores opacity as 0-100, Penpot as 0-1
    expect(tokenSets['C/M'].tokens['faded']).toMatchObject({ type: 'opacity', value: '0.5' });
  });

  it('translates string, font-family and boolean variables', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'C',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['label', 'family', 'flag'],
    });
    const variables = [
      makeVariable({ id: 'label', name: 'label', variableCollectionId: 'C1', resolvedType: 'STRING', scopes: [], valuesByMode: { m: 'Hello' } }),
      makeVariable({
        id: 'family',
        name: 'family',
        variableCollectionId: 'C1',
        resolvedType: 'STRING',
        scopes: ['FONT_FAMILY'],
        valuesByMode: { m: 'Inter' },
      }),
      makeVariable({ id: 'flag', name: 'flag', variableCollectionId: 'C1', resolvedType: 'BOOLEAN', scopes: [], valuesByMode: { m: true } }),
    ];

    const { tokenSets } = translateTokens(makeData([collection], variables), makeMapping());

    expect(tokenSets['C/M'].tokens['label']).toMatchObject({ type: 'string', value: 'Hello' });
    expect(tokenSets['C/M'].tokens['family']).toMatchObject({ type: 'fontFamily', value: ['Inter'] });
    expect(tokenSets['C/M'].tokens['flag']).toMatchObject({ type: 'boolean', value: 'true' });
  });

  it('skips remote collections and keeps the local ones', () => {
    const local = makeCollection({
      id: 'L',
      name: 'Local',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['v'],
    });
    const remote = makeCollection({
      id: 'R',
      name: 'Remote',
      remote: true,
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: [],
    });
    const variable = makeVariable({
      id: 'v',
      name: 'c',
      variableCollectionId: 'L',
      resolvedType: 'COLOR',
      valuesByMode: { m: { r: 0, g: 0, b: 0, a: 1 } },
    });

    const { tokenSets } = translateTokens(makeData([local, remote], [variable]), makeMapping());

    expect(Object.keys(tokenSets)).toEqual(['Local/M']);
  });

  it('reuses ids from the mapping so they stay stable across runs', () => {
    const collection = makeCollection({
      id: 'C1',
      name: 'C',
      defaultModeId: 'm',
      modes: [{ modeId: 'm', name: 'M' }],
      variableIds: ['v'],
    });
    const variable = makeVariable({
      id: 'v',
      name: 'c',
      variableCollectionId: 'C1',
      resolvedType: 'COLOR',
      valuesByMode: { m: { r: 0, g: 0, b: 0, a: 1 } },
    });
    const mapping = makeMapping();

    const first = translateTokens(makeData([collection], [variable]), mapping);
    const second = translateTokens(makeData([collection], [variable]), mapping);

    expect(second.tokenSets['C/M'].id).toBe(first.tokenSets['C/M'].id);
    expect(second.tokenSets['C/M'].tokens['c'].id).toBe(first.tokenSets['C/M'].tokens['c'].id);
    expect(second.tokenThemes['C/M'].id).toBe(first.tokenThemes['C/M'].id);
  });
});
