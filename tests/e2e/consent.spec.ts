import { test, expect } from '@playwright/test';

/**
 * Consent has to hold up in a real browser, not just in unit tests: the banner
 * must appear once, both answers must stick across a reload, and the decision
 * must be changeable afterwards. A banner that reappears on every page load is
 * as broken as one that never appears.
 */

const BASE = 'http://localhost:3000';

/**
 * `domcontentloaded`, not the default `load`.
 *
 * The homepage carries the whole catalogue, and in dev Next optimises every
 * remote product image on first request — so waiting for `load` here means
 * waiting on a dozen image round-trips that have nothing to do with a consent
 * banner. Each assertion below waits for the element it actually cares about.
 */
async function open(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  // The development notice is a full-screen modal shown on a first visit. The
  // consent banner deliberately waits behind it, so every test dismisses it
  // first — which is also what a real visitor does.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('seyon_dev_notice_seen', 'true');
    } catch {
      /* private mode */
    }
  });
});

test('the banner appears for a first-time visitor', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toBeVisible();
});

test('declining hides the banner and it stays gone after a reload', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'No thanks' }).click();

  await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);

  expect(await page.evaluate(() => localStorage.getItem('seyon-analytics-consent'))).toBe(
    'denied'
  );
});

test('accepting is remembered too', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: "That's fine" }).click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('seyon-analytics-consent'))).toBe(
    'granted'
  );
});

test('the decision can be reversed from the privacy policy', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: "That's fine" }).click();

  await open(page, '/privacy');
  await expect(page.getByText('Currently on')).toBeVisible();

  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Currently off')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('seyon-analytics-consent'))).toBe(
    'denied'
  );
});

test('nothing PostHog-related loads before a decision is made', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (req) => {
    if (/posthog/i.test(req.url())) analyticsRequests.push(req.url());
  });

  await open(page, '/');
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toBeVisible();
  await page.waitForTimeout(1500);

  expect(analyticsRequests).toEqual([]);
});

test('the legal pages never render an unfilled template', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/returns']) {
    await open(page, path);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('[name]');
    expect(body).not.toContain('[designation]');
    expect(body).not.toContain('required under the dpdp act');
  }
});

test('the banner waits behind the development notice rather than under it', async ({
  browser,
}) => {
  // A context without the init script above: this is a genuine first visit.
  const context = await browser.newContext();
  const page = await context.newPage();

  await open(page, '/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toBeVisible();
  // Clickable now, which it was not while the modal's backdrop covered it.
  await page.getByRole('button', { name: 'No thanks' }).click();
  await expect(page.getByRole('region', { name: 'Analytics consent' })).toHaveCount(0);

  await context.close();
});
