import type { OxlintConfig } from 'oxlint';

/**
 * Shared oxlint config object. Consume from a project's oxlint.config.ts:
 *   import kalpam from "@kalpam/oxlint-config";
 *   import { defineConfig } from "oxlint";
 *   export default defineConfig({ extends: [kalpam], env: { browser: true, node: true, es2024: true } });
 * NOTE: oxlint does NOT inherit `env` through `extends` (oxc#20087) — consumers re-declare it.
 */
const config: OxlintConfig = {
  plugins: ['typescript', 'react', 'jsx-a11y', 'import', 'oxc'],
  env: { browser: true, node: true, es2024: true },
  categories: { correctness: 'error', suspicious: 'warn', perf: 'warn', style: 'off' },
  rules: {
    'no-console': 'warn',
    'no-debugger': 'error',
    eqeqeq: 'error',
    'typescript/no-explicit-any': 'warn',
    'typescript/consistent-type-imports': 'error',
    'react/jsx-key': 'error',
    'import/no-duplicates': 'error',
    'jsx-a11y/alt-text': 'error',
    'react/react-in-jsx-scope': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      rules: { 'no-console': 'off', 'typescript/no-explicit-any': 'off' },
    },
    {
      // CLI scripts and build/config files write to stdout/stderr by design.
      files: ['**/scripts/**', '**/*.config.{js,cjs,mjs,ts,mts,cts}'],
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/*.d.ts',
  ],
};

export default config;
