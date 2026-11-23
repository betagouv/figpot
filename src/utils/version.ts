import fs from 'fs';
import path from 'path';

export const packageName = '@betagouv/figpot';

// The version is only written into `package.json` by the release process after the build, so it cannot be inlined
// at build time and has to be read at runtime. Since the bundler splits the code into chunks, the location of the
// running file inside the package is not fixed, so walking up the directories until reaching our own `package.json`
export function findPackageVersion(startDirectory: string): string | null {
  let directory = path.resolve(startDirectory);

  while (true) {
    const packageJsonPath = path.join(directory, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        if (packageJson.name === packageName && typeof packageJson.version === 'string') {
          return packageJson.version;
        }
      } catch {
        // Ignore an unreadable `package.json` and keep looking above
      }
    }

    const parentDirectory = path.dirname(directory);

    if (parentDirectory === directory) {
      return null;
    }

    directory = parentDirectory;
  }
}

export function formatVersion(version: string | null): string {
  // Outside a release the version stays the placeholder one, so making explicit it is not a published build
  if (!version || version === '0.0.0') {
    return '0.0.0-dev';
  }

  return version;
}
