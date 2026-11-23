import { chunkOperations, splitOperationsInHalves } from '@figpot/src/features/chunks';

// Each operation is encoded as `{"id":"x"}` (10 bytes) plus 1 byte of delimiter
const operation = (id: string, groupId?: string) => ({ id: id, ...(groupId ? { _groupId: groupId } : {}) });
const ids = (chunks: { id: string }[][]) => chunks.map((chunk) => chunk.map((op) => op.id).join(''));

describe('chunkOperations()', () => {
  it('should split operations by size', () => {
    const chunks = [
      ...chunkOperations(
        ['a', 'b', 'c', 'd', 'e'].map((id) => operation(id)),
        22
      ),
    ];

    expect(ids(chunks)).toEqual(['ab', 'cd', 'e']);
  });

  it('should move the ongoing group to the next chunk instead of splitting it', () => {
    const chunks = [...chunkOperations([operation('a'), operation('b'), operation('c', 'g'), operation('d', 'g'), operation('e')], 33)];

    expect(ids(chunks)).toEqual(['ab', 'cde']);
  });

  it('should not split a group even when the boundary is on its last operation', () => {
    const chunks = [...chunkOperations([operation('a'), operation('b', 'g'), operation('c', 'g'), operation('d')], 22)];

    expect(ids(chunks)).toEqual(['a', 'bc', 'd']);
  });

  it('should keep a group bigger than a chunk whole', () => {
    const chunks = [...chunkOperations([operation('a'), operation('b', 'g'), operation('c', 'g'), operation('d', 'g'), operation('e')], 22)];

    expect(ids(chunks)).toEqual(['a', 'bcd', 'e']);
  });

  it('should treat consecutive groups separately', () => {
    const chunks = [...chunkOperations([operation('a', 'g1'), operation('b', 'g1'), operation('c', 'g2'), operation('d', 'g2')], 33)];

    expect(ids(chunks)).toEqual(['ab', 'cd']);
  });

  it('should strip the group markers', () => {
    expect([...chunkOperations([operation('a', 'g')], 100)]).toEqual([[{ id: 'a' }]]);
  });
});

describe('splitOperationsInHalves()', () => {
  it('should split in two parts of about the same size', () => {
    expect(ids(splitOperationsInHalves(['a', 'b', 'c', 'd'].map((id) => operation(id))))).toEqual(['ab', 'cd']);
  });

  it('should not split a group', () => {
    expect(ids(splitOperationsInHalves([operation('a'), operation('b', 'g'), operation('c', 'g'), operation('d', 'g')]))).toEqual(['a', 'bcd']);
  });

  it('should return a single part when it cannot be split', () => {
    expect(ids(splitOperationsInHalves([operation('a')]))).toEqual(['a']);
    expect(ids(splitOperationsInHalves([operation('a', 'g'), operation('b', 'g')]))).toEqual(['ab']);
  });
});
