import { test, expect, type Page } from '@playwright/test';

/**
 * The three pages that existed only as unreachable functions.
 *
 * These are navigation-and-render tests rather than workflow tests — the
 * workflows they sit on top of are already covered in moderation.spec.ts. What
 * is worth asserting here is that each page is reachable from the screen a
 * person would actually start on, shows the thing it was written to show, and
 * is closed to anyone who is not an admin.
 */

const BASE = 'http://localhost:3000';
const ADMIN = 'admintest@example.com';
const OWNER = 'adminowner@example.com';

async function go(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (err) {
      if (!String(err).includes('ERR_ABORTED') || attempt === 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
}

async function login(page: Page, email: string) {
  await go(page, `${BASE}/login`);
  const form = page.locator('form:has(input[type="email"])');
  await form.locator('input[type="email"]').fill(email);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

async function ready(page: Page, url: string) {
  await go(page, url);
  await page.waitForLoadState('load');
}

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await login(page, ADMIN);
});

test.afterAll(async () => {
  await page?.close();
});

/* ------------------------------------------------------- complaint detail */

test('a complaint opens from the queue and shows both deadlines', async () => {
  await ready(page, `${BASE}/admin/reports?status=all`);
  await expect(page.getByTestId('complaint-row').first()).toBeVisible({ timeout: 20000 });

  await page.getByTestId('complaint-open').first().click();
  await page.waitForURL(/\/admin\/reports\/[a-z0-9]+/, { timeout: 20000 });
  await page.waitForLoadState('load');

  await expect(page.getByTestId('complaint-category')).toBeVisible();
  await expect(page.getByTestId('complaint-reason')).not.toBeEmpty();

  // Both obligations, stated separately. Acknowledging in time does not stop
  // the thirty-day disposal clock, and the page has to say so.
  await expect(page.getByTestId('sla-ack')).toBeVisible();
  await expect(page.getByTestId('sla-resolve')).toBeVisible();

  // Reachable back to the store it is about.
  await expect(page.getByTestId('complaint-store-link')).toBeVisible();
});

test('an unknown complaint id is a 404, not a crash', async () => {
  const res = await page.goto(`${BASE}/admin/reports/clzzzzzzzzzzzzzzzzzzzzzzzz`, {
    waitUntil: 'domcontentloaded',
  });
  expect(res?.status()).toBe(404);
});

/* --------------------------------------------------------- account detail */

test('an account opens from the access list and shows its role history', async () => {
  await ready(page, `${BASE}/admin/access`);
  await expect(page.getByTestId('access-row').first()).toBeVisible({ timeout: 20000 });

  await page.getByTestId('access-open').first().click();
  await page.waitForURL(/\/admin\/access\/[a-z0-9]+/, { timeout: 20000 });
  await page.waitForLoadState('load');

  await expect(page.getByTestId('account-name')).toBeVisible();
  await expect(page.getByTestId('account-role')).toBeVisible();
  await expect(page.getByTestId('account-details')).toBeVisible();

  // Either a history or an explicit statement that there is none — never a
  // blank space that could be read as "nothing happened".
  const hasHistory = await page.getByTestId('account-audit').count();
  const hasEmpty = await page.getByTestId('account-audit-empty').count();
  expect(hasHistory + hasEmpty).toBeGreaterThan(0);
});

/* --------------------------------------------------------------- audit log */

/**
 * The fixtures clear AdminAction deliberately — the store detail page asserts an
 * empty history — so there is nothing to list until something is done. Rather
 * than seeding rows, this drives a real action and then looks for it in the log,
 * which also proves the path from action to audit row to global view.
 */
test('an action taken anywhere shows up in the audit log', async () => {
  await ready(page, `${BASE}/admin/stores/audit-shop`);
  await expect(page.getByTestId('toggle-verify')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('toggle-verify').click();
  await expect(page.getByTestId('audit-action').first()).toHaveText(/VERIFY_SHOP|UNVERIFY_SHOP/, {
    timeout: 20000,
  });

  await ready(page, `${BASE}/admin/audit`);
  await expect(page.getByTestId('audit-log-row').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('audit-log-action').first()).toHaveText(/VERIFY_SHOP|UNVERIFY_SHOP/);
  await expect(page.getByTestId('audit-log-actor').first()).toContainText('Admin Tester');
});

test('the audit log filters, and says so when nothing matches', async () => {
  await ready(page, `${BASE}/admin/audit`);
  await expect(page.getByTestId('audit-log-row').first()).toBeVisible({ timeout: 20000 });

  // A combination that cannot match what was just recorded, so an unfiltered
  // list would be an obvious failure rather than a plausible one.
  await page.getByTestId('audit-target-filter').selectOption('Notice');
  await page.getByTestId('audit-action-filter').selectOption('DELETE_SHOP');
  await page.getByTestId('audit-filter-submit').click();
  await page.waitForLoadState('load');
  await expect(page.getByTestId('audit-log-empty')).toBeVisible();

  await page.getByTestId('audit-clear').click();
  await page.waitForLoadState('load');
  await expect(page.getByTestId('audit-log-row').first()).toBeVisible();
});

test('an impossible date range is refused rather than returning nothing', async () => {
  await ready(page, `${BASE}/admin/audit?from=2026-08-20&to=2026-08-01`);
  await expect(page.getByTestId('audit-error')).toContainText('ends before it starts');
});

test('the audit log offers no way to change what it recorded', async () => {
  await ready(page, `${BASE}/admin/audit`);
  await expect(page.getByTestId('audit-log-row').first()).toBeVisible({ timeout: 20000 });

  // A log an admin can prune is not evidence. The only controls on the page are
  // the filter form and its links.
  await expect(page.getByRole('button', { name: /delete|remove|edit|clear entr/i })).toHaveCount(0);
});

/* ----------------------------------------------------------- access control */

test('a non-admin reaches none of the three', async ({ browser }) => {
  const ctx = await browser.newContext();
  const seller = await ctx.newPage();
  await login(seller, OWNER);

  for (const path of ['/admin/audit', '/admin/access', '/admin/reports']) {
    await go(seller, `${BASE}${path}`);
    await seller.waitForLoadState('load');
    expect(new URL(seller.url()).pathname).not.toBe(path);
  }

  await ctx.close();
});

/* ------------------------------------------------------------ store removal */

/**
 * Removing a store is the one admin action with no undo, so both gates are
 * asserted separately: a reason alone must not be enough, and the right slug
 * alone must not be enough either. This runs last in the file because it
 * destroys a fixture the earlier tests navigate to.
 */
test('removing a store needs a reason and the exact address', async () => {
  await ready(page, `${BASE}/admin/stores/audit-shop`);
  await expect(page.getByTestId('delete-store')).toBeVisible({ timeout: 20000 });

  await page.getByTestId('delete-store-open').click();
  await expect(page.getByTestId('delete-store-confirm')).toBeDisabled();

  // A reason on its own: still refused.
  await page.getByTestId('delete-store-reason').fill('Selling counterfeit goods; three complaints upheld.');
  await expect(page.getByTestId('delete-store-confirm')).toBeDisabled();

  // The wrong address: still refused.
  await page.getByTestId('delete-store-slug').fill('audit-shopp');
  await expect(page.getByTestId('delete-store-confirm')).toBeDisabled();

  // A near miss with the right prefix: still refused.
  await page.getByTestId('delete-store-slug').fill('audit-sho');
  await expect(page.getByTestId('delete-store-confirm')).toBeDisabled();

  await page.getByTestId('delete-store-slug').fill('audit-shop');
  await expect(page.getByTestId('delete-store-confirm')).toBeEnabled();
});

test('a removed store is gone from the admin list, and its record is not', async () => {
  await ready(page, `${BASE}/admin/stores/audit-shop`);
  await page.getByTestId('delete-store-open').click();
  await page.getByTestId('delete-store-reason').fill('Selling counterfeit goods; three complaints upheld.');
  await page.getByTestId('delete-store-slug').fill('audit-shop');
  await page.getByTestId('delete-store-confirm').click();

  // Redirected off the page that no longer has anything to show.
  await page.waitForURL(/\/admin\/stores(\?|$)/, { timeout: 30000 });
  await page.waitForLoadState('load');

  // Gone from search.
  await page.getByTestId('store-search').fill('audit-shop');
  await page.getByTestId('store-search-submit').click();
  await page.waitForLoadState('load');
  await expect(page.getByTestId('store-empty')).toBeVisible();

  // The storefront no longer shows the store. Asserted on content rather than
  // status: a missing shop renders not-found copy with HTTP 200 in this route
  // group — that is F-15, a known and separately tracked gap (see the fixme in
  // audit-regression.spec.ts), and asserting 404 here would be testing that
  // open issue rather than this deletion.
  await ready(page, `${BASE}/store/audit-shop`);
  await expect(page.getByText('Audit Regression Store')).toHaveCount(0);

  // But the record of why survives, with the store described inside it.
  await ready(page, `${BASE}/admin/audit?action=DELETE_SHOP`);
  await expect(page.getByTestId('audit-log-action').first()).toHaveText('DELETE_SHOP');
  await expect(page.getByTestId('audit-log-reason').first()).toContainText('counterfeit');
});

/* ------------------------------------------------------- SLA performance */

test('the performance report counts an untouched complaint against the month', async () => {
  await ready(page, `${BASE}/admin/reports/performance`);

  await expect(page.getByTestId('performance-table')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('performance-row').first()).toBeVisible();

  // The fixtures seed one complaint three days old and unacknowledged. It has
  // to appear as a miss rather than be excluded for not being closed — the
  // difference between an honest report and a flattering one.
  await expect(page.getByTestId('miss-count')).not.toHaveText('(0)');
  await expect(page.getByTestId('miss-row').first()).toBeVisible();
  await expect(page.getByTestId('miss-open-badge').first()).toBeVisible();

  // And the page says out loud what the denominator is, because a good number
  // here is open to a flattering misreading otherwise.
  await expect(page.getByTestId('performance-denominator-note')).toContainText('not of everything closed');
});

test('the CSV export is the same report, not a second implementation', async () => {
  const res = await page.request.get(`${BASE}/admin/reports/performance/export?months=6`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  expect(res.headers()['content-disposition']).toContain('seyon-complaint-performance-');

  const body = await res.text();
  const lines = body.trim().split('\n');
  expect(lines[0]).toContain('acknowledgement_rate');
  expect(lines.length).toBeGreaterThan(1);
});

test('a non-admin cannot download the compliance figures', async ({ browser }) => {
  const ctx = await browser.newContext();
  const seller = await ctx.newPage();
  await login(seller, OWNER);

  const res = await seller.request.get(`${BASE}/admin/reports/performance/export`);
  expect(res.status()).toBe(403);

  await ctx.close();
});
