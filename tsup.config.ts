import path from 'path';
import { defineConfig } from 'tsup';

const entryPattern = path.resolve(__dirname, 'src/index.ts');

export default defineConfig((options) => {
  return {
    entry: [entryPattern],
    outDir: 'dist',
    format: ['cjs', 'esm', 'iife'],
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
