import { translatePageName } from '@figpot/src/features/transformers/transformPageNode';

describe('translatePageName()', () => {
  it('turns an empty page named with dashes into the Penpot divider name', () => {
    expect(translatePageName({ name: '————', children: [] })).toBe('---');
    expect(translatePageName({ name: '----', children: [] })).toBe('---');
    expect(translatePageName({ name: ' --- ', children: [] })).toBe('---');
    expect(translatePageName({ name: '–––', children: [] })).toBe('---');
  });

  it('keeps the other names', () => {
    expect(translatePageName({ name: 'Icônes ( Icons )', children: [] })).toBe('Icônes ( Icons )');
    expect(translatePageName({ name: '--- Section', children: [] })).toBe('--- Section');
    expect(translatePageName({ name: '   ', children: [] })).toBe('   ');
  });

  it('keeps the name of a page with content', () => {
    const page = { name: '————', children: [{}] } as Parameters<typeof translatePageName>[0];

    expect(translatePageName(page)).toBe('————');
  });
});
