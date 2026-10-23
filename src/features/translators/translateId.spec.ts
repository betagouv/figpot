import { MappingType } from '@figpot/src/features/document';
import { translateMediaId, translateMediaPlaceholderId } from '@figpot/src/features/translators/translateId';

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
