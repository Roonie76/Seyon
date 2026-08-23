import { describe, it, expect } from 'vitest';
import { checkEnvironment } from '../src/backend/lib/env-check';

const complete = {
  NODE_ENV: 'production',
  AUTH_SECRET: 'a-real-secret-value-of-sufficient-length',
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/seyon',
  SUPABASE_URL: 'https://abcdefg.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real',
  NEXT_PUBLIC_POSTHOG_KEY: 'phc_realprojectkey',
  UPSTASH_REDIS_REST_URL: 'https://real.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'real-token',
  SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1',
  NEXT_PUBLIC_SITE_URL: 'https://seyon.example',
  NEXT_PUBLIC_GRIEVANCE_NAME: 'A. Sharma',
  NEXT_PUBLIC_GRIEVANCE_DESIGNATION: 'Grievance Officer',
  NEXT_PUBLIC_GRIEVANCE_EMAIL: 'grievance@seyon.in',
} as NodeJS.ProcessEnv;

describe('production configuration check', () => {
  it('passes a fully configured production environment', () => {
    const { fatal, warnings } = checkEnvironment(complete);
    expect(fatal).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('refuses to start when image storage is unconfigured', () => {
    const { fatal } = checkEnvironment({ ...complete, SUPABASE_URL: undefined });
    expect(fatal.join(' ')).toContain('SUPABASE_URL');
  });

  it('treats a mock storage host as unconfigured', () => {
    const { fatal } = checkEnvironment({
      ...complete,
      SUPABASE_URL: 'https://mock-project.supabase.co',
    });
    expect(fatal.join(' ')).toContain('placeholder stock photos');
  });

  it('refuses to start without an auth secret', () => {
    const { fatal } = checkEnvironment({
      ...complete,
      AUTH_SECRET: undefined,
      NEXTAUTH_SECRET: undefined,
    });
    expect(fatal.join(' ')).toContain('AUTH_SECRET');
  });

  it('accepts NEXTAUTH_SECRET alone', () => {
    const { fatal } = checkEnvironment({
      ...complete,
      AUTH_SECRET: undefined,
      NEXTAUTH_SECRET: 'a-real-secret-value-of-sufficient-length',
    });
    expect(fatal).toEqual([]);
  });

  it('flags a dev-login flag that reached production', () => {
    const { fatal } = checkEnvironment({ ...complete, ALLOW_INSECURE_DEV_LOGIN: 'true' });
    expect(fatal.join(' ')).toContain('ALLOW_INSECURE_DEV_LOGIN');
  });

  it('warns rather than fails on a placeholder analytics key', () => {
    const { fatal, warnings } = checkEnvironment({
      ...complete,
      NEXT_PUBLIC_POSTHOG_KEY: 'mock-posthog-key',
    });
    expect(fatal).toEqual([]);
    expect(warnings.join(' ')).toContain('Analytics are not being collected');
  });

  it('warns when Upstash is absent, since Postgres covers it', () => {
    const { fatal, warnings } = checkEnvironment({
      ...complete,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(fatal).toEqual([]);
    expect(warnings.join(' ')).toContain('Upstash');
  });

  it('never fails a development environment', () => {
    const { fatal } = checkEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(fatal).toEqual([]);
  });
});
