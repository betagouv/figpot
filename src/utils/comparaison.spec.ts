import { getDiff } from '@figpot/src/utils/comparaison';

describe('getDiff()', () => {
  it('should compare maps of objects', async () => {
    const before = new Map([
      [1, { id: 1, myProp: 1 }],
      [2, { id: 2, myProp: 2 }],
      [3, { id: 3, myProp: 3 }],
    ]);

    const after = new Map([
      [2, { id: 2, myProp: 222 }],
      [3, { id: 3, myProp: 3 }],
      [4, { id: 4, myProp: 4 }],
    ]);

    const diffResult = getDiff(before, after);

    expect(diffResult.get(4)?.state).toBe('added');
    expect(diffResult.get(1)?.state).toBe('removed');
    expect(diffResult.get(3)?.state).toBe('unchanged');
    expect(diffResult.get(2)?.state).toBe('updated');
  });
});
