import { defineConfig, type ViteUserConfig } from 'vitest/config';

/** Stack-agnostic Vitest base. Consume via mergeConfig in a project's vitest.config.ts. */
const base: ViteUserConfig = defineConfig({
  test: {
    globals: false,
    clearMocks: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/dist/**', '**/*.config.*', '**/*.d.ts'],
    },
  },
});

export default base;
