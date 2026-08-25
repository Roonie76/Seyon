import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Who may run the nightly job.
 *
 * This endpoint sweeps identity documents. It has no session behind it, so the
 * only thing between it and the internet is a shared secret — which makes the
 * refusal cases the ones worth testing, not the success case.
 */

vi.mock('@/backend/lib/scheduled-jobs', () => ({
  runDailyJobs: vi.fn().mockResolvedValue([{ name: 'kyc-retention', did: 0 }]),
}));
vi.mock('@/backend/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const ORIGINAL = process.env.CRON_SECRET;

function request(auth?: string) {
  return new Request('http://localhost/api/cron/daily', {
    headers: auth ? { authorization: auth } : {},
  });
}

async function route() {
  return import('@/app/api/cron/daily/route');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe('the cron route', () => {
  it('refuses everything when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await route();
    const res = await GET(request('Bearer anything'));

    // 503, not 401: the endpoint is not merely unauthorised, it is unusable,
    // and it must never be open because a variable was forgotten.
    expect(res.status).toBe(503);
    const { runDailyJobs } = await import('@/backend/lib/scheduled-jobs');
    expect(runDailyJobs).not.toHaveBeenCalled();
  });

  it('refuses a request with no authorization header', async () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-value';
    const { GET } = await route();
    expect((await GET(request())).status).toBe(401);
  });

  it('refuses the wrong secret', async () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-value';
    const { GET } = await route();
    expect((await GET(request('Bearer not-the-secret'))).status).toBe(401);
  });

  it('refuses a secret of the right length but wrong content', async () => {
    // The case a length check alone would let through.
    process.env.CRON_SECRET = 'abcdefghijklmnop';
    const { GET } = await route();
    expect((await GET(request('Bearer ponmlkjihgfedcba'))).status).toBe(401);
  });

  it('refuses a correct secret sent without the Bearer prefix', async () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-value';
    const { GET } = await route();
    expect((await GET(request('a-long-enough-secret-value'))).status).toBe(401);
  });

  it('refuses a prefix of the secret', async () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-value';
    const { GET } = await route();
    expect((await GET(request('Bearer a-long-enough'))).status).toBe(401);
  });

  it('runs the jobs for the right secret', async () => {
    process.env.CRON_SECRET = 'a-long-enough-secret-value';
    const { GET } = await route();
    const res = await GET(request('Bearer a-long-enough-secret-value'));

    expect(res.status).toBe(200);
    const { runDailyJobs } = await import('@/backend/lib/scheduled-jobs');
    expect(runDailyJobs).toHaveBeenCalledTimes(1);
  });
});
