import { transformStrokeWidthTokens } from '@figpot/src/features/transformers/partials/transformStrokeWidthTokens';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';

describe('transformStrokeWidthTokens()', () => {
  it('drops the stroke width tokens of shapes without stroke only', () => {
    const page = {
      id: 'page',
      name: 'Page',
      objects: {
        noStroke: { id: 'noStroke', type: 'frame', strokes: [], appliedTokens: { strokeWidthTop: 'w', fill: 'c' } },
        onlyWidth: { id: 'onlyWidth', type: 'path', appliedTokens: { strokeWidthTop: 'w', strokeWidthLeft: 'w' } },
        stroked: { id: 'stroked', type: 'rect', strokes: [{ strokeWidth: 1 }], appliedTokens: { strokeWidthTop: 'w' } },
      },
    } as unknown as PenpotPage;

    transformStrokeWidthTokens(page);

    expect((page.objects['noStroke'] as any).appliedTokens).toEqual({ fill: 'c' });
    expect((page.objects['onlyWidth'] as any).appliedTokens).toBeUndefined();
    expect((page.objects['stroked'] as any).appliedTokens).toEqual({ strokeWidthTop: 'w' });
  });
});
