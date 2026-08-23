/**
 * Audit regression suite (August 2026).
 * Kept separate from vitest.config.ts so `npm test` stays green while the
 * confirmed defects are still open. Run with:
 *   npx vitest run --config vitest.regression.config.ts
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['tests/regression/**/*.regression.ts'],
      exclude: ['**/node_modules/**', '**/.next/**', 'tests/e2e/**'],
    },
  })
);
