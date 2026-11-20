import { mergeExtraVariables, patchVariables } from '@figpot/src/features/figma';
import { FigmaVariablesData } from '@figpot/src/features/translators/tokens/translateTokens';

function stringVariable(id: string, scopes: string[], value: string) {
  return { id: id, name: id, resolvedType: 'STRING', scopes: scopes, valuesByMode: { mode: value } };
}

describe('patchVariables()', () => {
  it('redirects the font family variables like the fonts of the nodes', () => {
    const variables = {
      variableCollections: {},
      variables: {
        family: stringVariable('family', ['FONT_FAMILY'], 'Marianne Variable'),
        all: stringVariable('all', ['ALL_SCOPES'], 'Marianne Variable'),
        label: stringVariable('label', ['TEXT_CONTENT'], 'Marianne Variable'),
      },
    } as unknown as FigmaVariablesData;

    patchVariables(variables, [{ search: /^Marianne Variable$/, set: 'Marianne' }]);

    expect(variables.variables['family'].valuesByMode['mode']).toBe('Marianne');
    expect(variables.variables['all'].valuesByMode['mode']).toBe('Marianne');
    // A text content is not a font
    expect(variables.variables['label'].valuesByMode['mode']).toBe('Marianne Variable');
  });
});

describe('mergeExtraVariables()', () => {
  it('completes the REST variables with the exported ones, the REST ones winning on common IDs', () => {
    const rest = {
      variableCollections: { 'C:lib': { id: 'C:lib', variableIds: ['V:bound'] } },
      variables: { 'V:bound': { id: 'V:bound', name: 'rest' } },
    } as unknown as FigmaVariablesData;
    const extra = {
      variableCollections: {
        'C:lib': { id: 'C:lib', variableIds: ['V:bound', 'V:other'] },
        'C:modes': { id: 'C:modes', variableIds: [] },
      },
      variables: { 'V:bound': { id: 'V:bound', name: 'extra' }, 'V:other': { id: 'V:other', name: 'other' } },
    } as unknown as FigmaVariablesData;

    const merged = mergeExtraVariables(rest, extra);

    expect(merged.variableCollections['C:lib'].variableIds).toEqual(['V:bound', 'V:other']);
    expect(merged.variableCollections['C:modes']).toBeDefined();
    expect(merged.variables['V:bound'].name).toBe('rest');
    expect(merged.variables['V:other'].name).toBe('other');
  });
});
