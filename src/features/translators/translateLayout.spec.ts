import { translateGridTracks } from '@figpot/src/features/translators/translateLayout';

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
