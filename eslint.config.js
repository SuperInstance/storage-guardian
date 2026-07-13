/**
 * ESLint flat config (v9).
 *
 * Makes the declared `npm run lint` script a real, working static-analysis
 * gate. Uses the non-type-aware recommended ruleset (the strict `tsc`
 * typecheck is the separate `typecheck` / CI gate) so linting does not
 * require type information from tsconfig.
 */

const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals used across the codebase
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Allow unused args prefixed with _ (common in rule conditions, etc.)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // The codebase intentionally uses `any` at the S3/CLI boundary for the
      // optional @aws-sdk peer dependency; the strict typecheck covers the rest.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Jest globals for test files
    files: ['src/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
