import { orderComponentSetChildren } from '@figpot/src/features/transformers/transformComponentSetNode';

function componentSet(layoutMode: string, names: string[], defaultValue: string) {
  return {
    layoutMode,
    componentPropertyDefinitions: { Icon: { type: 'VARIANT', defaultValue } },
    children: names.map((name) => ({ name })),
  } as any;
}

describe('orderComponentSetChildren()', () => {
  it('reverses the variants of an auto layout so the flow order is kept and the default one ends last', () => {
    const node = componentSet('HORIZONTAL', ['Icon=None', 'Icon=Start', 'Icon=End'], 'None');

    orderComponentSetChildren(node);
    expect(node.children.map((child: { name: string }) => child.name)).toEqual(['Icon=End', 'Icon=Start', 'Icon=None']);
  });

  it('moves the default variant last without an auto layout', () => {
    const node = componentSet('NONE', ['Icon=None', 'Icon=Start', 'Icon=End'], 'None');

    orderComponentSetChildren(node);
    expect(node.children.map((child: { name: string }) => child.name)).toEqual(['Icon=Start', 'Icon=End', 'Icon=None']);
  });

  it('still moves a default variant that is not first in the flow', () => {
    const node = componentSet('VERTICAL', ['Icon=Start', 'Icon=None', 'Icon=End'], 'None');

    orderComponentSetChildren(node);

    expect(node.children.map((child: { name: string }) => child.name)).toEqual(['Icon=End', 'Icon=Start', 'Icon=None']);
  });
});
