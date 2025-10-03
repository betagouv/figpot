import dotenv from 'dotenv';
import { getTsconfig } from 'get-tsconfig';
import { Config } from 'jest';
import path from 'path';
import { pathsToModuleNameMapper } from 'ts-jest';

const fullTsconfig = getTsconfig();
if (!fullTsconfig) {
  throw new Error(`a "tsconfig.json" must be provided`);
}

// Load test variables if any
dotenv.config({ path: path.resolve(__dirname, './.env.jest') });
dotenv.config({ path: path.resolve(__dirname, './.env.jest.local') });

// Add any custom config to be passed to Jest
const customJestConfig: Config = {
  preset: 'ts-jest',
  setupFilesAfterEnv: [],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  moduleNameMapper: {
    ...(fullTsconfig.config.compilerOptions && fullTsconfig.config.compilerOptions.paths
      ? pathsToModuleNameMapper(fullTsconfig.config.compilerOptions.paths, { prefix: '<rootDir>/' })
      : {}),
  },
  testEnvironment: 'jest-environment-node',
  modulePathIgnorePatterns: ['<rootDir>/data/'],
  testPathIgnorePatterns: ['<rootDir>/data/', '<rootDir>/node_modules/'],
  transformIgnorePatterns: [],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '\\.[jt]s$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true, // It disables type checking to make it faster (note it's not taken by default from the `tsconfig.json`)
      },
    ],
  },
};

// Used to specify the default cache directory in our CI/CD environment
// Note: it cannot be set to undefined directly into the config object because Jest would take it due to the object key existing, so using a separate condition
if (typeof process.env.JEST_CACHE_PATH === 'string') {
  customJestConfig.cacheDirectory = process.env.JEST_CACHE_PATH;
}

export default customJestConfig;
