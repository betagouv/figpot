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

    expect(diffResult).toStrictEqual({
      added: [{ id: 4, myProp: 4 }],
      removed: [{ id: 1, myProp: 1 }],
      unchanged: [{ id: 3, myProp: 3 }],
      updated: [{ id: 2, myProp: 222 }],
    });
  });
});
