import { logger } from './logger';
import { isGrievanceOfficerAppointed } from '@/shared/data/legal-entity';

/**
 * Startup configuration check.
 *
 * Several failures in this codebase were silent misconfigurations rather than
 * bugs: a missing SUPABASE_URL turned uploads into random stock photos, a
 * placeholder PostHog key meant no analytics were collected at all, and a
 * missing rate-limit backend made the limits per-instance. None of them
 * announced themselves — the app just quietly did the wrong thing.
 *
 * This runs once at boot. FATAL problems throw, because a deployment that
 * cannot do its job correctly should fail loudly rather than serve wrong data.
 * WARN problems are logged with enough detail to act on.
 */

interface Check {
  name: string;
  level: 'fatal' | 'warn';
  failing: () => boolean;
  message: string;
}

const isPlaceholder = (v: string | undefined): boolean =>
  !v ||
  v.trim() === '' ||
  /^(your[-_]|mock-|changeme|placeholder|xxx|todo)/i.test(v.trim());

export function checkEnvironment(env: NodeJS.ProcessEnv = process.env): {
  fatal: string[];
  warnings: string[];
} {
  const isProduction = env.NODE_ENV === 'production';

  const checks: Check[] = [
    {
      name: 'AUTH_SECRET',
      level: 'fatal',
      failing: () => isPlaceholder(env.AUTH_SECRET) && isPlaceholder(env.NEXTAUTH_SECRET),
      message:
        'No auth secret is set. Sessions cannot be signed. Set AUTH_SECRET (and keep NEXTAUTH_SECRET identical if both are present).',
    },
    {
      name: 'DATABASE_URL',
      level: 'fatal',
      failing: () => isPlaceholder(env.DATABASE_URL),
      message: 'DATABASE_URL is not set.',
    },
    {
      name: 'SUPABASE_URL',
      level: 'fatal',
      failing: () => isPlaceholder(env.SUPABASE_URL) || (env.SUPABASE_URL ?? '').includes('mock-project'),
      message:
        'Image storage is not configured. Uploads would silently return placeholder stock photos instead of the seller\'s own images.',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      level: 'fatal',
      failing: () => isPlaceholder(env.SUPABASE_SERVICE_ROLE_KEY),
      message: 'SUPABASE_SERVICE_ROLE_KEY is not set; uploads and deletes will fail.',
    },
    {
      name: 'ALLOW_INSECURE_DEV_LOGIN',
      level: 'fatal',
      failing: () => env.ALLOW_INSECURE_DEV_LOGIN === 'true',
      message:
        'ALLOW_INSECURE_DEV_LOGIN is set in a production environment. It is already ignored in production, but its presence means a development env file has been deployed — check what else came with it.',
    },
    {
      name: 'NEXT_PUBLIC_POSTHOG_KEY',
      level: 'warn',
      failing: () => isPlaceholder(env.NEXT_PUBLIC_POSTHOG_KEY),
      message:
        'Analytics are not being collected: the PostHog key is missing or a placeholder. You will have no funnel and no activation data.',
    },
    {
      name: 'UPSTASH_REDIS_REST_URL',
      level: 'warn',
      failing: () =>
        isPlaceholder(env.UPSTASH_REDIS_REST_URL) || isPlaceholder(env.UPSTASH_REDIS_REST_TOKEN),
      message:
        'Upstash is not configured. Rate limiting falls back to the Postgres backend, which is correct across instances but adds a write per limited request.',
    },
    {
      name: 'CRON_SECRET',
      level: 'warn',
      failing: () => isPlaceholder(env.CRON_SECRET),
      message:
        'No CRON_SECRET: the nightly job route refuses every request, so abandoned identity documents are never swept, sellers who ignore a notice are never chased, and nobody is told when complaints are about to breach their deadline.',
    },
    {
      name: 'SENTRY_DSN',
      level: 'warn',
      failing: () => isPlaceholder(env.SENTRY_DSN) && isPlaceholder(env.NEXT_PUBLIC_SENTRY_DSN),
      message: 'No Sentry DSN: runtime errors will not be reported anywhere.',
    },
    {
      name: 'NEXT_PUBLIC_GRIEVANCE_*',
      level: 'warn',
      failing: () => !isGrievanceOfficerAppointed(env as Record<string, string | undefined>),
      message:
        'No Grievance Officer is appointed. The DPDP Act 2023 and the Consumer Protection ' +
        '(E-Commerce) Rules 2020 require a named individual with published contact details. ' +
        'The privacy policy and terms currently fall back to the support inbox. Set ' +
        'NEXT_PUBLIC_GRIEVANCE_NAME, _DESIGNATION and _EMAIL (and optionally _ADDRESS).',
    },
    {
      name: 'NEXT_PUBLIC_SITE_URL',
      level: 'warn',
      failing: () => isPlaceholder(env.NEXT_PUBLIC_SITE_URL),
      message:
        'NEXT_PUBLIC_SITE_URL is unset; canonical URLs, the sitemap and OpenGraph tags will point at the wrong origin.',
    },
  ];

  const fatal: string[] = [];
  const warnings: string[] = [];

  for (const check of checks) {
    if (!check.failing()) continue;
    // Outside production these are informational: local development is
    // expected to run without storage or analytics configured.
    if (check.level === 'fatal' && isProduction) fatal.push(`${check.name}: ${check.message}`);
    else warnings.push(`${check.name}: ${check.message}`);
  }

  return { fatal, warnings };
}

/** Called once from instrumentation.register(). */
export function assertEnvironment(): void {
  const { fatal, warnings } = checkEnvironment();

  for (const warning of warnings) {
    logger.warn(`Configuration: ${warning}`);
  }

  if (fatal.length > 0) {
    const detail = fatal.map((f) => `  - ${f}`).join('\n');
    logger.error('Refusing to start: production configuration is incomplete', undefined, {
      problems: fatal,
    });
    throw new Error(
      `Seyon cannot start with this configuration:\n${detail}\n\n` +
        'These are fatal in production because the alternative is serving wrong data silently.'
    );
  }
}
