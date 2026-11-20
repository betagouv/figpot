import { translateGridTracks } from '@figpot/src/features/translators/translateLayout';

describe('translateGridTracks()', () => {
  it('makes hugging tracks auto', () => {
    expect(translateGridTracks('repeat(2,fit-content(100%))', 2)).toEqual([{ type: 'auto' }, { type: 'auto' }]);
  });

  it('reads fractions, fixed sizes and mixed lists', () => {
    expect(translateGridTracks('repeat(2,minmax(0,1fr))', 2)).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
    expect(translateGridTracks('  372px 372px', 2)).toEqual([
      { type: 'fixed', value: 372 },
      { type: 'fixed', value: 372 },
    ]);
    expect(translateGridTracks('   fit-content(100%) minmax(0,1fr) 24.00px', 3)).toEqual([
      { type: 'auto' },
      { type: 'flex', value: 1 },
      { type: 'fixed', value: 24 },
    ]);
  });

  it('keeps equal fractions when the sizes do not match the track count', () => {
    expect(translateGridTracks(undefined, 2)).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
    expect(translateGridTracks('repeat(3,fit-content(100%))', 2)).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
  });
});
