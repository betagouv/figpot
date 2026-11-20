import { translateGridTracks, translateLayoutGap } from '@figpot/src/features/translators/translateLayout';

describe('translateGridTracks()', () => {
  it('makes hugging tracks auto', () => {
    expect(translateGridTracks('repeat(2,fit-content(100%))', 2)).toEqual([{ type: 'auto' }, { type: 'auto' }]);
  });

  it('reads fractions, fixed sizes, percentages and mixed lists', () => {
    expect(translateGridTracks('repeat(2,minmax(0,1fr))', 2)).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
    expect(translateGridTracks('  372px 372px', 2)).toEqual([
      { type: 'fixed', value: 372 },
      { type: 'fixed', value: 372 },
    ]);
    expect(translateGridTracks('   fit-content(100%) minmax(0, 2fr) 24.00px 50%', 4)).toEqual([
      { type: 'auto' },
      { type: 'flex', value: 2 },
      { type: 'fixed', value: 24 },
      { type: 'percent', value: 50 },
    ]);
  });

  it('keeps equal fractions when the sizes cannot be read or do not match the track count', () => {
    const equal = [
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ];

    expect(translateGridTracks(undefined, 2)).toEqual(equal);
    expect(translateGridTracks('repeat(3,fit-content(100%))', 2)).toEqual(equal);
    expect(translateGridTracks('10px calc(100% - 10px)', 2)).toEqual(equal);
  });
});

describe('translateLayoutGap()', () => {
  it('puts the spacing along the layout direction and the spacing between wrapped lines on the other axis', () => {
    expect(translateLayoutGap('HORIZONTAL', 8, false, 16)).toEqual({ rowGap: 16, columnGap: 8 });
    expect(translateLayoutGap('VERTICAL', 8, false, 16)).toEqual({ rowGap: 8, columnGap: 16 });
  });

  it('keeps the spacing between wrapped lines when the items are spread', () => {
    expect(translateLayoutGap('HORIZONTAL', 8, true, 16)).toEqual({ rowGap: 16, columnGap: 0 });
  });
});
