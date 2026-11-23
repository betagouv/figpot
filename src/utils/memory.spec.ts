import { getMemoryAdvice } from '@figpot/src/utils/memory';

const gigabyte = 1024 * 1024 * 1024;

describe('getMemoryAdvice()', () => {
  it('should warn when Node.js is allowed more memory than available', () => {
    const advice = getMemoryAdvice({ heapLimit: 12 * gigabyte, totalMemory: 12 * gigabyte, availableMemory: 9 * gigabyte }, false);

    expect(advice).toContain('allowed to use 12.0 GB');
    expect(advice).toContain('9.0 GB available on this machine (12.0 GB in total)');
    expect(advice).toContain('NODE_OPTIONS=--max_old_space_size=7372');
  });

  it('should only suggest raising a low limit for large documents', () => {
    const context = { heapLimit: 4 * gigabyte, totalMemory: 16 * gigabyte, availableMemory: 14 * gigabyte };

    expect(getMemoryAdvice(context, false)).toBeNull();
    expect(getMemoryAdvice(context, true)).toContain('only allowed to use 4.0 GB');
  });

  it('should not warn when the limit fits the machine', () => {
    expect(getMemoryAdvice({ heapLimit: 7 * gigabyte, totalMemory: 12 * gigabyte, availableMemory: 9 * gigabyte }, true)).toBeNull();
  });
});
