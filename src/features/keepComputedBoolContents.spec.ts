import { keepComputedBoolContents } from '@figpot/src/features/document';

describe('keepComputedBoolContents()', () => {
  it('keeps the content Penpot computed for a boolean Figma gave no geometry for', () => {
    const computed = [{ command: 'move-to', params: { x: 0, y: 0 } }];
    const hosted = { data: { pagesIndex: { p: { objects: { b: { type: 'bool', content: computed, width: 3 }, c: { type: 'bool', content: computed } } } } } } as any;
    const transformed = { data: { pagesIndex: { p: { objects: { b: { type: 'bool', content: [], width: 2 }, c: { type: 'bool', content: [{ command: 'close-path', params: null }] } } } } } } as any;

    expect(keepComputedBoolContents(hosted, transformed)).toBe(1);
    expect(transformed.data.pagesIndex.p.objects.b).toEqual({ type: 'bool', content: computed, width: 3 });
    // A boolean with a Figma geometry is left untouched
    expect(transformed.data.pagesIndex.p.objects.c.content).toEqual([{ command: 'close-path', params: null }]);
  });
});
