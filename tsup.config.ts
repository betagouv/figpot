import path from 'path';
import { defineConfig } from 'tsup';

const entryPattern = path.resolve(__dirname, 'src/index.ts');
const cliPattern = path.resolve(__dirname, 'src/cli/index.ts');

export default defineConfig((options) => {
  return {
    entry: [entryPattern, cliPattern],
    outDir: 'dist',
    // Librairies like `change-case` are ESM-only and cannot be imported from a CJS package, so we decided to only package the ESM format
    // It should be fine since `figpot` is intended to be used as a CLI, and not directly imported into third-party code
    // Other formats can be reconsidered once Node v22 has more traction, since from this version it's allowed for CJS to import ESM modules
    format: ['esm'],
    // format: ['cjs', 'esm', 'iife'],
    globalName: 'Figpot',
    minify: !options.watch,
    splitting: true,
    split: [],
    dts: true,
    sourcemap: true,
    shims: true,
    clean: true,
    async onSuccess() {},
  };
});
