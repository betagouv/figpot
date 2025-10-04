import path from 'path';
import { defineConfig } from 'tsup';

const entryPattern = path.resolve(__dirname, 'src/index.ts');
const cliPattern = path.resolve(__dirname, 'src/cli/index.ts');

export default defineConfig((options) => {
  return {
    entry: [entryPattern, cliPattern],
    outDir: 'dist',
    format: ['esm'],
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
