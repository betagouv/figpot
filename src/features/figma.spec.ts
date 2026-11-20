import { patchVariables } from '@figpot/src/features/figma';
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
