import { describe, it, expect, vi, beforeEach } from 'vitest';

// Intercept NextAuth import and track configuration arguments passed to NextAuth()
const mockNextAuth = vi.fn().mockReturnValue({
  handlers: {},
  auth: {},
  signIn: {},
  signOut: {},
});

vi.mock('next-auth', () => ({
  default: mockNextAuth,
}));

// Mock the Google provider to return the exact options object passed to it
vi.mock('next-auth/providers/google', () => ({
  default: vi.fn().mockImplementation((options) => options),
}));

// Mock adapter and database connections to avoid database instantiation during test import
vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/db', () => ({
  db: {},
}));

describe('NextAuth allowDangerousEmailAccountLinking config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockNextAuth.mockClear();
    // Reset module cache so src/backend/lib/auth executes fresh on each test case
    vi.resetModules();
  });

  it('is FALSE by default when env is unset', async () => {
    await import('../src/backend/lib/auth');
    const config = mockNextAuth.mock.calls[0][0];
    const googleProvider = config.providers[0];
    expect(googleProvider.allowDangerousEmailAccountLinking).toBe(false);
  });

  it('stays FALSE for invalid values', async () => {
    vi.stubEnv('ALLOW_DANGEROUS_ACCOUNT_LINKING', 'false');
    await import('../src/backend/lib/auth');
    const config = mockNextAuth.mock.calls[0][0];
    expect(config.providers[0].allowDangerousEmailAccountLinking).toBe(false);
  });

  it('resolves to TRUE only when explicitly set to "true"', async () => {
    vi.stubEnv('ALLOW_DANGEROUS_ACCOUNT_LINKING', 'true');
    await import('../src/backend/lib/auth');
    const config = mockNextAuth.mock.calls[0][0];
    expect(config.providers[0].allowDangerousEmailAccountLinking).toBe(true);
  });
});
