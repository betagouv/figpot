import os from 'os';
import v8 from 'v8';

const megabyte = 1024 * 1024;

// Node.js frees memory lazily until reaching its heap limit, so the limit must leave room for the operating system and
// the other programs, otherwise the process is killed by the operating system without any error message
const recommendedShareOfAvailableMemory = 0.8;

export type MemoryContext = {
  heapLimit: number;
  totalMemory: number;
  availableMemory: number;
};

export function getMemoryContext(): MemoryContext {
  // A container or CI runner may be limited below the machine memory
  const constrainedMemory = process.constrainedMemory();
  const totalMemory = constrainedMemory > 0 && constrainedMemory < os.totalmem() ? constrainedMemory : os.totalmem();

  return {
    heapLimit: v8.getHeapStatistics().heap_size_limit,
    totalMemory: totalMemory,
    availableMemory: Math.min(os.freemem(), totalMemory),
  };
}

function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 / megabyte).toFixed(1)} GB`;
}

export function getMemoryAdvice(context: MemoryContext, largeDocument: boolean): string | null {
  const recommendedHeapLimit = Math.floor((context.availableMemory * recommendedShareOfAvailableMemory) / megabyte);
  const command = `NODE_OPTIONS=--max_old_space_size=${recommendedHeapLimit}`;
  const memoryState = `${formatGigabytes(context.availableMemory)} available on this machine (${formatGigabytes(context.totalMemory)} in total)`;

  if (context.heapLimit > context.availableMemory) {
    return `Node.js is allowed to use ${formatGigabytes(context.heapLimit)} of memory but only ${memoryState}: since Node.js frees memory lazily up to its limit, the operating system may kill the process without any error message. Prefer prefixing the command with "${command}" (about 80% of the available memory, lower it if other programs will need memory meanwhile)`;
  } else if (largeDocument && context.heapLimit < recommendedHeapLimit * megabyte * 0.75) {
    return `Node.js is only allowed to use ${formatGigabytes(context.heapLimit)} of memory whereas ${memoryState}, which may not be enough for a large document. If the process crashes with "heap out of memory", prefix the command with "${command}" (about 80% of the available memory, lower it if other programs will need memory meanwhile)`;
  }

  return null;
}
