export type GroupableOperation = {
  _groupId?: string;
  _lastOfTheGroup?: boolean;
};

// Splits operations into chunks whose JSON encoding stays under the given size, without splitting operations of a same
// group (the Penpot backend needs them at the same time to have a valid tree). Groups are contiguous in the operations list
// Note: a group bigger than a chunk is kept whole, so this chunk may exceed the size
export function* chunkOperations<Operation extends GroupableOperation>(
  operations: Operation[],
  maxBytes: number
): Generator<Omit<Operation, '_groupId' | '_lastOfTheGroup'>[]> {
  let chunk: Omit<Operation, '_groupId' | '_lastOfTheGroup'>[] = [];
  let sizes: number[] = [];
  let bytes = 0;
  let currentGroupId: string | null = null;
  let currentGroupStart = 0; // Index in the chunk of the first operation of the current group

  for (const markedOperation of operations) {
    const { _groupId } = markedOperation;
    const operation = stripGroupMarkers(markedOperation);
    const size = JSON.stringify(operation).length + 1; // Taking into account the `,` delimiter
    const groupId = _groupId ?? null;

    if (groupId === null || groupId !== currentGroupId) {
      currentGroupId = groupId;
      currentGroupStart = chunk.length;
    }

    // A group filling the whole chunk cannot be moved, so it keeps growing
    const groupFillsChunk = currentGroupId !== null && currentGroupStart === 0;

    if (chunk.length > 0 && bytes + size > maxBytes && !groupFillsChunk) {
      // The operations of the ongoing group are moved to the next chunk
      const forwardedCount = currentGroupId !== null ? chunk.length - currentGroupStart : 0;
      const forwardedOperations = chunk.splice(chunk.length - forwardedCount, forwardedCount);
      const forwardedSizes = sizes.splice(sizes.length - forwardedCount, forwardedCount);

      yield chunk;

      chunk = forwardedOperations;
      sizes = forwardedSizes;
      bytes = forwardedSizes.reduce((total, forwardedSize) => total + forwardedSize, 0);
      currentGroupStart = 0;
    }

    chunk.push(operation);
    sizes.push(size);
    bytes += size;
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}

export function stripGroupMarkers<Operation extends GroupableOperation>(operation: Operation): Omit<Operation, '_groupId' | '_lastOfTheGroup'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _groupId, _lastOfTheGroup, ...strippedOperation } = operation;

  return strippedOperation;
}

// Splits operations in two parts of about the same size without splitting a group, to isolate an operation making the
// Penpot backend fail by sending smaller parts. Returns a single part when it cannot be split (one operation or one group)
export function splitOperationsInHalves<Operation extends GroupableOperation>(operations: Operation[]): Operation[][] {
  const sizes = operations.map((operation) => JSON.stringify(stripGroupMarkers(operation)).length + 1);
  const totalBytes = sizes.reduce((total, size) => total + size, 0);

  let bestIndex = -1;
  let bestDistance = Infinity;
  let bytesBefore = 0;

  for (let index = 1; index < operations.length; index++) {
    bytesBefore += sizes[index - 1];

    // A boundary inside a group is not allowed
    const groupId = operations[index]._groupId;
    if (groupId !== undefined && groupId === operations[index - 1]._groupId) {
      continue;
    }

    const distance = Math.abs(totalBytes / 2 - bytesBefore);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex === -1 ? [operations] : [operations.slice(0, bestIndex), operations.slice(bestIndex)];
}
