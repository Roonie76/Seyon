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
      // Point the APPLICATION's Prisma client at the test database too.
      // Without this, code under test writes to the real DATABASE_URL while
      // the test harness reads the test database, and assertions silently
      // measure the wrong rows.
      env: {
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          'postgresql://postgres@127.0.0.1:5432/seyon_test?schema=public',
        DIRECT_URL:
          process.env.TEST_DATABASE_URL ||
          'postgresql://postgres@127.0.0.1:5432/seyon_test?schema=public',
      },
      include: ['tests/integration/**/*.integration.ts'],
      exclude: ['**/node_modules/**', '**/.next/**', 'tests/e2e/**'],
      // Shared database: no parallel file execution.
      fileParallelism: false,
      testTimeout: 20_000,
      hookTimeout: 20_000,
    },
  })
);
