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

    // Themes are intentionally not auto-emitted; the user creates bundles in Penpot's UI on demand
    expect(tokenThemes).toEqual({});
  });

  it('creates one set per collection mode (themes are not auto-emitted)', () => {
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
    expect(tokenThemes).toEqual({});
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

    const { tokenSets, aliasesToUnknownNames } = translateTokens(makeData([collection], [variable]), makeMapping());

    expect(tokenSets['C/M'].tokens).toEqual({});
    expect(aliasesToUnknownNames).toEqual(['remote']);
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
  });
});

describe('translateTokens() aliases', () => {
  const modes = [{ modeId: 'm:1', name: 'Default' }];

  function expectNoDanglingReference(tokens: Record<string, { value: unknown }>) {
    const names = new Set(Object.keys(tokens));

    for (const token of Object.values(tokens)) {
      for (const [, reference] of String(token.value).matchAll(/\{([^}]+)\}/g)) {
        expect(names).toContain(reference);
      }
    }
  }

  it('refers to a token the aliased variable gives, whatever the order and the scopes', () => {
    // `spacing.any` (all scopes, so one token per type) is listed before the variable it aliases, which is scoped to sizes
    // only: the alias of its `borderRadius` token cannot refer to a `borderRadius` token of `size.4`, there is none
    const collection = makeCollection({ id: 'C:1', name: 'Dimensions', modes, defaultModeId: 'm:1', variableIds: ['V:any', 'V:4'] });
    const any = makeVariable({
      id: 'V:any',
      name: 'spacing/any',
      variableCollectionId: 'C:1',
      resolvedType: 'FLOAT',
      scopes: ['ALL_SCOPES'],
      valuesByMode: { 'm:1': { type: 'VARIABLE_ALIAS', id: 'V:4' } },
    });
    const four = makeVariable({
      id: 'V:4',
      name: 'size/4',
      variableCollectionId: 'C:1',
      resolvedType: 'FLOAT',
      scopes: ['WIDTH_HEIGHT'],
      valuesByMode: { 'm:1': 4 },
    });

    const tokens = translateTokens(makeData([collection], [any, four]), makeMapping()).tokenSets['Dimensions/Default'].tokens;

    // The aliased token keeps its own name (no `-1` from a name reserved for a token never written)
    expect(tokens['size.4']).toMatchObject({ type: 'sizing', value: '4' });
    expect(tokens['spacing.any-borderRadius']).toMatchObject({ type: 'borderRadius', value: '{size.4}' });
    expectNoDanglingReference(tokens);
  });

  it('skips the aliases leading to a variable that gives no token, through a chain of aliases', () => {
    // `a` aliases `b` which aliases a variable of a remote collection (not synchronized)
    const collection = makeCollection({ id: 'C:1', name: 'Dimensions', modes, defaultModeId: 'm:1', variableIds: ['V:a', 'V:b', 'V:ok'] });
    const remoteCollection = makeCollection({
      id: 'C:remote',
      name: 'Library',
      modes,
      defaultModeId: 'm:1',
      variableIds: ['V:remote'],
      remote: true,
    });
    const variables = [
      makeVariable({
        id: 'V:a',
        name: 'a',
        variableCollectionId: 'C:1',
        resolvedType: 'FLOAT',
        scopes: ['GAP'],
        valuesByMode: { 'm:1': { type: 'VARIABLE_ALIAS', id: 'V:b' } },
      }),
      makeVariable({
        id: 'V:b',
        name: 'b',
        variableCollectionId: 'C:1',
        resolvedType: 'FLOAT',
        scopes: ['GAP'],
        valuesByMode: { 'm:1': { type: 'VARIABLE_ALIAS', id: 'V:remote' } },
      }),
      makeVariable({ id: 'V:ok', name: 'ok', variableCollectionId: 'C:1', resolvedType: 'FLOAT', scopes: ['GAP'], valuesByMode: { 'm:1': 8 } }),
      makeVariable({
        id: 'V:remote',
        name: 'remote',
        variableCollectionId: 'C:remote',
        resolvedType: 'FLOAT',
        scopes: ['GAP'],
        valuesByMode: { 'm:1': 4 },
        remote: true,
      }),
    ];

    const { tokenSets, aliasesToUntokenizedNames } = translateTokens(makeData([collection, remoteCollection], variables), makeMapping());

    expect(Object.keys(tokenSets['Dimensions/Default'].tokens)).toEqual(['ok']);
    expect(aliasesToUntokenizedNames).toEqual(['a', 'b']);
  });

  it('writes the unlisted variables an alias references, unless a listed variable has the same name', () => {
    // `hidden` (hidden from publishing) and `copy` (the same variable as `regular` under another ID) are not listed
    const collection = makeCollection({ id: 'C:1', name: 'Dimensions', modes, defaultModeId: 'm:1', variableIds: ['V:a', 'V:b', 'V:regular'] });
    const variable = (id: string, name: string, value: number | { type: 'VARIABLE_ALIAS'; id: string }) =>
      makeVariable({ id: id, name: name, variableCollectionId: 'C:1', resolvedType: 'FLOAT', scopes: ['GAP'], valuesByMode: { 'm:1': value } });
    const variables = [
      variable('V:a', 'a', { type: 'VARIABLE_ALIAS', id: 'V:hidden' }),
      variable('V:b', 'b', { type: 'VARIABLE_ALIAS', id: 'V:copy' }),
      variable('V:regular', 'regular', 4),
      variable('V:hidden', 'hidden', 8),
      variable('V:copy', 'regular', 4),
      variable('V:unused', 'unused', 16),
    ];

    const tokens = translateTokens(makeData([collection], variables), makeMapping()).tokenSets['Dimensions/Default'].tokens;

    expect(Object.fromEntries(Object.entries(tokens).map(([name, token]) => [name, token.value]))).toEqual({
      a: '{hidden}',
      b: '{regular}',
      regular: '4',
      hidden: '8',
    });
  });
});

describe('translateTokens() with token contexts', () => {
  const previous = process.env.FIGPOT_TOKEN_CONTEXTS;

  beforeAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = 'true';
  });

  afterAll(() => {
    process.env.FIGPOT_TOKEN_CONTEXTS = previous;
  });

  it('makes one theme group of a collection and its extensions, named after the one holding the variables', () => {
    const modes = [
      { modeId: 'm:1', name: 'Light' },
      { modeId: 'm:2', name: 'Dark' },
    ];
    // Nodes set the modes of the empty parent, the values live in the extension sharing its key and mode IDs
    const parent = makeCollection({ id: 'C:parent', key: 'K', name: 'Theme', modes, defaultModeId: 'm:1', variableIds: [], remote: true });
    const extension = makeCollection({
      id: 'C:ext',
      key: 'K',
      name: '❖ Brand theme',
      modes,
      defaultModeId: 'm:1',
      variableIds: ['V:1'],
      remote: true,
    });
    const variable = makeVariable({
      id: 'V:1',
      name: 'brand/accent',
      variableCollectionId: 'C:ext',
      resolvedType: 'COLOR',
      scopes: ['ALL_FILLS'],
      valuesByMode: { 'm:1': { r: 1, g: 1, b: 0, a: 1 }, 'm:2': { r: 0, g: 0, b: 1, a: 1 } },
      remote: true,
    });

    const result = translateTokens(makeData([parent, extension], [variable]), makeMapping());
    const groups = new Set(Object.values(result.tokenThemes).map((theme) => theme.group));

    expect(groups).toEqual(new Set(['Brand theme']));
    expect(result.tokenThemes['Brand theme/Dark'].sets).toEqual(['BrandTheme/Dark']);
    // The mode set on the parent and on the extension resolve to the same theme
    expect(result.themeIdsByCollectionMode.get('C:parent/m:2')).toBe(result.tokenThemes['Brand theme/Dark'].id);
    expect(result.themeIdsByCollectionMode.get('C:ext/m:2')).toBe(result.tokenThemes['Brand theme/Dark'].id);
    expect(result.activeThemes).toEqual(['Brand theme/Light']);
  });
});
