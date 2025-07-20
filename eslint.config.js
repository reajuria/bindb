import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        URL: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        // TypeScript globals
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript rules
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-const': 'error',

      // General JavaScript rules
      'no-console': 'off', // Allow console.log for debugging and logging
      'no-debugger': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Code style (handled by Prettier but good to have as backup)
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'es5'],

      // Prettier integration
      'prettier/prettier': 'error',

      // Allow hasOwnProperty usage
      'no-prototype-builtins': 'off',
    },
    ...prettierConfig,
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/jest.setup.js',
      'benchmarks/**/*.ts',
    ],
    rules: {
      // Relax rules for test files and benchmarks
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'warn', // Relax to warning for tests
      'no-console': 'off',
    },
  },
  {
    files: [
      'types/**/*.ts',
      'engine/column.ts',
      'engine/row-serializer.ts',
      'engine/buffer-utils.ts',
      'engine/buffer-schema-calculator.ts',
      'engine/write-buffer.ts',
      'http/**/*.ts',
    ],
    rules: {
      // Type definition files and implementation files with complex signatures
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-data-*/**',
      '*.d.ts',
      'eslint.config.js',
      'jest.config.mjs',
      'jest.setup.js',
    ],
  },
];
