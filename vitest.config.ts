import { defineConfig } from 'vitest/config';

// Root-level tests for the release machinery (scripts/*.test.mjs).
// `turbo run test` covers per-package tests; this config covers the repo-root
// scripts that turbo's package-scoped task cannot see.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
  },
});
