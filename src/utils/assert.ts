import assert from 'assert';

// [WORKAROUND] The normal `assert()` call will be slow without a default message due to reading the source code
// Ref: https://github.com/nodejs/node/issues/52962#issuecomment-2473883051
export function workaroundAssert(value: unknown, message?: string | Error): asserts value {
  assert(value, message || 'fallback due to slow official assert otherwise');
}
