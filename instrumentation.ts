import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail fast on a misconfigured production deployment. Several of the worst
    // findings in the August audit were silent misconfigurations rather than
    // bugs — uploads returning stock photos, analytics collecting nothing.
    const { assertEnvironment } = await import('./src/backend/lib/env-check');
    assertEnvironment();

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
