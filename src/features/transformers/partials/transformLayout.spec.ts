import { adaptFillingOnlyChild } from '@figpot/src/features/transformers/partials/transformLayout';

type Frame = Parameters<typeof adaptFillingOnlyChild>[0];
function hugFrame(children: object[]): Frame {
  return { layoutMode: 'HORIZONTAL', layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG', children: children };
}

function fillingText(height: number) {
  return {
    type: 'TEXT',
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FILL',
    absoluteBoundingBox: { height: height },
    style: { textAutoResize: 'HEIGHT', lineHeightPx: 24 },
  };
}

describe('adaptFillingOnlyChild()', () => {
  it('makes the only laid out child of a hugging frame hug instead of filling', () => {
    const text = fillingText(24);

    adaptFillingOnlyChild(hugFrame([{ type: 'FRAME', layoutPositioning: 'ABSOLUTE', layoutSizingHorizontal: 'FIXED' }, text]));

    expect(text.layoutSizingHorizontal).toBe('HUG');
    expect(text.layoutSizingVertical).toBe('HUG');
    expect(text.style.textAutoResize).toBe('WIDTH_AND_HEIGHT');
  });

  it('keeps the width of a wrapping text so it does not go on a single line', () => {
    const text = fillingText(72);

    adaptFillingOnlyChild(hugFrame([text]));

    expect(text.layoutSizingHorizontal).toBe('FIXED');
    expect(text.style.textAutoResize).toBe('HEIGHT');
  });

  it('makes an auto layout child hug and fixes the size of other shapes', () => {
    const frame = { type: 'FRAME', layoutMode: 'VERTICAL', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FILL' };
    const vector = { type: 'VECTOR', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FILL' };

    adaptFillingOnlyChild(hugFrame([frame]));
    adaptFillingOnlyChild(hugFrame([vector]));

    expect([frame.layoutSizingHorizontal, frame.layoutSizingVertical]).toEqual(['HUG', 'HUG']);
    expect([vector.layoutSizingHorizontal, vector.layoutSizingVertical]).toEqual(['FIXED', 'FIXED']);
  });

  it('keeps filling children among several laid out ones', () => {
    const text = fillingText(24);

    adaptFillingOnlyChild(hugFrame([{ type: 'FRAME', layoutSizingHorizontal: 'FIXED' }, text]));

    expect(text.layoutSizingHorizontal).toBe('FILL');
    expect(text.style.textAutoResize).toBe('HEIGHT');
  });
});
