import { cleanPath } from '@figpot/src/utils/path';

describe('cleanPath()', () => {
  it('should normalize spaces and remove empty segments', () => {
    expect(cleanPath('Icônes fonctionnelles  / fr--sign-language')).toBe('Icônes fonctionnelles / fr--sign-language');
    expect(cleanPath(' a/b //  c ')).toBe('a / b / c');
    expect(cleanPath('single')).toBe('single');
    expect(cleanPath('')).toBe('');
  });
});
