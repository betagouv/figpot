import { MappingType } from '@figpot/src/features/document';
import { translateComponentShapeId, translateMediaId, translateMediaPlaceholderId } from '@figpot/src/features/translators/translateId';
import { deterministicUuid } from '@figpot/src/utils/uuid';

describe('translateMediaId()', () => {
  it('should use the uploaded identifier when mapped', () => {
    const mapping = { assets: new Map([['abc', '74db4ea5-7f73-8164-8008-d55aa9e0f3d1']]) } as MappingType;

    expect(translateMediaId('abc', mapping)).toBe('74db4ea5-7f73-8164-8008-d55aa9e0f3d1');
  });

  it('should use a stable placeholder without mapping it when not uploaded yet', () => {
    const mapping = { assets: new Map() } as MappingType;

    expect(translateMediaId('abc', mapping)).toBe(translateMediaPlaceholderId('abc'));
    expect(translateMediaPlaceholderId('abc')).not.toBe(translateMediaPlaceholderId('def'));
    expect(mapping.assets.size).toBe(0);
  });
});

describe('translateComponentShapeId()', () => {
  it('should derive the same ID for a shape inside a nested instance of a main and for the path copies refer to it with', () => {
    // Like `penpot-exporter-figma-plugin`, the leading `I` is removed
    expect(translateComponentShapeId('I1:2;5:1')).toBe(deterministicUuid('1:2;5:1'));
    expect(translateComponentShapeId('1:2')).toBe(deterministicUuid('1:2'));
  });
});
