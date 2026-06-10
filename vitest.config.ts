import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/.next/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@/components': path.resolve(__dirname, './src/frontend/components'),
      '@/actions': path.resolve(__dirname, './src/backend/actions'),
      '@/lib/auth': path.resolve(__dirname, './src/backend/lib/auth'),
      '@/lib/db': path.resolve(__dirname, './src/backend/lib/db'),
      '@/lib/supabase': path.resolve(__dirname, './src/backend/lib/supabase'),
      '@/lib/posthog': path.resolve(__dirname, './src/frontend/lib/posthog'),
      '@/lib/utils': path.resolve(__dirname, './src/frontend/lib/utils'),
      '@/lib/seo': path.resolve(__dirname, './src/shared/lib/seo'),
      '@/lib/zod-schemas': path.resolve(__dirname, './src/shared/lib/zod-schemas'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
