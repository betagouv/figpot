module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'import'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: { node: true, browser: true, jest: true },
  ignorePatterns: ['data', 'dist', 'src/clients/figma', 'src/clients/penpot'], // The API clients are generated
  rules: {
    'interface-name': 'off',
    'no-console': 'off',
    'no-constant-condition': 'off',
    'no-implicit-dependencies': 'off',
    'no-submodule-imports': 'off',
    'no-trailing-spaces': 'error',
    'no-unused-vars': 'off',
    // When hunting dead code it's useful to use the following:
    // ---
    // 'no-unused-vars': 'error',
    // 'import/no-unused-modules': [1, { unusedExports: true }],
  },
  overrides: [
    {
      files: ['figma-plugins/**/*.js'],
      globals: {
        figma: 'readonly',
        __html__: 'readonly',
      },
    },
  ],
};
