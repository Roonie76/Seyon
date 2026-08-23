/**
 * Integration suite — runs against a real Postgres.
 *
 * Separate from vitest.config.ts because these need a database and are slower;
 * `npm test` stays a fast, dependency-free unit run.
 *
 *   createdb seyon_test
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/seyon_test \
 *     npx prisma db push
 *   npm run test:integration
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // Node, not jsdom: these talk to Postgres, not the DOM.
      environment: 'node',
      include: ['tests/integration/**/*.integration.ts'],
      exclude: ['**/node_modules/**', '**/.next/**', 'tests/e2e/**'],
      // Shared database: no parallel file execution.
      fileParallelism: false,
      testTimeout: 20_000,
      hookTimeout: 20_000,
    },
  })
);
