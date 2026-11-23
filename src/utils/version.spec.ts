import fs from 'fs';
import os from 'os';
import path from 'path';

import { findPackageVersion, formatVersion, packageName } from '@figpot/src/utils/version';

describe('findPackageVersion()', () => {
  let rootDirectory: string;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'figpot-version-'));
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { recursive: true, force: true });
  });

  it('should find the version of our package from a nested directory', () => {
    fs.writeFileSync(path.join(rootDirectory, 'package.json'), JSON.stringify({ name: packageName, version: '1.2.3' }));
    const nestedDirectory = path.join(rootDirectory, 'dist', 'cli');
    fs.mkdirSync(nestedDirectory, { recursive: true });

    expect(findPackageVersion(nestedDirectory)).toBe('1.2.3');
  });

  it('should skip the package.json of other packages', () => {
    fs.writeFileSync(path.join(rootDirectory, 'package.json'), JSON.stringify({ name: packageName, version: '1.2.3' }));
    const otherPackageDirectory = path.join(rootDirectory, 'node_modules', 'other');
    fs.mkdirSync(otherPackageDirectory, { recursive: true });
    fs.writeFileSync(path.join(otherPackageDirectory, 'package.json'), JSON.stringify({ name: 'other', version: '9.9.9' }));

    expect(findPackageVersion(otherPackageDirectory)).toBe('1.2.3');
  });
});

describe('formatVersion()', () => {
  it('should flag the placeholder version as a development one', () => {
    expect(formatVersion('0.0.0')).toBe('0.0.0-dev');
    expect(formatVersion(null)).toBe('0.0.0-dev');
  });

  it('should keep a released version', () => {
    expect(formatVersion('1.4.3')).toBe('1.4.3');
  });
});
