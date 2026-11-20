import { translatePageName } from '@figpot/src/features/transformers/transformPageNode';

describe('translatePageName()', () => {
  it('turns a name made of dashes into the Penpot divider name', () => {
    expect(translatePageName('————')).toBe('---');
    expect(translatePageName('----')).toBe('---');
    expect(translatePageName(' --- ')).toBe('---');
    expect(translatePageName('–––')).toBe('---');
  });

  it('keeps the other names', () => {
    expect(translatePageName('Icônes ( Icons )')).toBe('Icônes ( Icons )');
    expect(translatePageName('--- Section')).toBe('--- Section');
    expect(translatePageName('   ')).toBe('   ');
  });
});
