import { adaptFillingOnlyChildren } from '@figpot/src/features/transformers/transformDocumentNode';

describe('adaptFillingOnlyChildren()', () => {
  it('makes the only laid out child of a hugging frame hug instead of filling', () => {
    const text = { type: 'TEXT', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', style: { textAutoResize: 'HEIGHT' } };
    const frame = {
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
      children: [{ type: 'FRAME', layoutPositioning: 'ABSOLUTE', layoutSizingHorizontal: 'FIXED' }, text],
    };

    adaptFillingOnlyChildren(frame);

    expect(text.layoutSizingHorizontal).toBe('HUG');
    expect(text.style.textAutoResize).toBe('WIDTH_AND_HEIGHT');
  });

  it('keeps filling children among several laid out ones', () => {
    const text = { type: 'TEXT', layoutSizingHorizontal: 'FILL', style: { textAutoResize: 'HEIGHT' } };
    const frame = {
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      layoutSizingHorizontal: 'HUG',
      children: [{ type: 'FRAME', layoutSizingHorizontal: 'FIXED' }, text],
    };

    adaptFillingOnlyChildren(frame);

    expect(text.layoutSizingHorizontal).toBe('FILL');
    expect(text.style.textAutoResize).toBe('HEIGHT');
  });
});
