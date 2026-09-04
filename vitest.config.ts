import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/contracts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['miniprogram/**/*.ts', 'shared/**/*.ts', 'scripts/{build,check-package,verify-docs}.mjs'],
      exclude: ['miniprogram/config/runtime.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
    },
  },
});
