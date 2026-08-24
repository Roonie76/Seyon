import { test, expect, type Page } from '@playwright/test';

/**
 * The admin dashboard, in a real browser.
 *
 * The assertions worth having here are the ones about *restraint*: that a
 * destructive action cannot be taken without a reason, and that the record of
 * it appears afterwards. Those are the two properties that were entirely
 * absent before, and both are invisible until something goes wrong.
 */

const BASE = 'http://localhost:3000';
const ADMIN = 'admintest@example.com';
const SHOP_SLUG = 'admin-test-store';

async function go(page: import('@playwright/test').Page, url: string) {
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

async function login(page: import('@playwright/test').Page, email: string) {
  await go(page, `${BASE}/login`);
  const form = page.locator('form:has(input[type="email"])');
  await form.locator('input[type="email"]').fill(email);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

/**
 * One login for the whole suite.
 *
 * Logging in per test tripped the real rate limiter — LOGIN is 5 per minute per
 * email — and the sixth test simply stayed on /login. That is the limiter
 * working, not a bug, so the fix belongs here: a serial suite shares one
 * authenticated page rather than re-authenticating seven times in forty
 * seconds.
 */
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await login(page, ADMIN);
});

test.afterAll(async () => {
  await page.close();
});

test('store search finds a store by name, owner email and phone number', async () => {
  await go(page, `${BASE}/admin/stores`);
  await page.waitForLoadState('load');

  await expect(page.getByTestId('store-row').first()).toBeVisible({ timeout: 20000 });

  for (const term of ['Admin Test Store', 'adminowner@example.com', '919700000001']) {
    await page.getByTestId('store-search').fill(term);
    await page.getByTestId('store-search-submit').click();
    await page.waitForLoadState('load');
    await expect(page.getByTestId('store-row')).toHaveCount(1);
    await expect(page.getByTestId('store-rows')).toContainText('Admin Test Store');
  }
});

test('the status filter narrows to unlisted stores', async () => {
  await go(page, `${BASE}/admin/stores?status=unlisted`);
  await page.waitForLoadState('load');
  // The seeded store is listed, so filtering to unlisted must exclude it —
  // and with nothing left the table is not rendered at all, which is why this
  // asserts on the empty state rather than on an absent row.
  await expect(page.getByTestId('store-row')).toHaveCount(0);
  await expect(page.getByTestId('store-empty')).toBeVisible();

  // ...and the same filter set to "listed" finds it again, so the assertion
  // above is about the filter rather than about the search being broken.
  await go(page, `${BASE}/admin/stores?status=listed`);
  await page.waitForLoadState('load');
  await expect(page.getByTestId('store-rows')).toContainText('Admin Test Store');
});

test('the detail page shows who the owner actually is', async () => {
  await go(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.waitForLoadState('load');

  await expect(page.getByTestId('store-name')).toHaveText('Admin Test Store');
  await expect(page.getByTestId('owner-email')).toHaveText('adminowner@example.com');
  await expect(page.getByTestId('product-list')).toContainText('Admin Test Widget');
  await expect(page.getByTestId('audit-empty')).toBeVisible();
});

test('suspension is refused without a reason, and recorded with one', async () => {
  await go(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.waitForLoadState('load');

  await page.getByTestId('suspend-open').click();

  // Empty reason: the confirm button stays disabled. A suspension that does not
  // explain itself is one the seller cannot answer.
  await expect(page.getByTestId('suspend-confirm')).toBeDisabled();
  await page.getByTestId('suspend-reason').fill('too short');
  await expect(page.getByTestId('suspend-confirm')).toBeDisabled();

  await page.getByTestId('suspend-reason').fill('Selling counterfeit goods; three buyer reports upheld.');
  await expect(page.getByTestId('suspend-confirm')).toBeEnabled();
  await page.getByTestId('suspend-confirm').click();

  // The record that did not exist before this work.
  await expect(page.getByTestId('audit-trail')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('audit-action').first()).toHaveText('SUSPEND_SHOP');
  await expect(page.getByTestId('audit-trail')).toContainText('counterfeit');
  await expect(page.getByTestId('audit-trail')).toContainText('Admin Tester');
});

test('reinstating is recorded too', async () => {
  await go(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.waitForLoadState('load');

  await page.getByTestId('unsuspend').click();
  await expect(page.getByTestId('audit-action').first()).toHaveText('UNSUSPEND_SHOP', { timeout: 20000 });
});

test('deleting a product demands a reason', async () => {
  await go(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.waitForLoadState('load');

  await page.getByTestId('delete-product').first().click();
  await expect(page.getByTestId('delete-product-confirm')).toBeDisabled();

  await page.getByTestId('delete-product-reason').fill('Duplicate listing of the same item.');
  await expect(page.getByTestId('delete-product-confirm')).toBeEnabled();
  await page.getByTestId('delete-product-confirm').click();

  // Deleting the only product removes the list entirely, so assert on the text
  // being gone from the page rather than absent from an element that no longer
  // exists — a negative assertion against a missing locator fails outright.
  await expect(page.getByText('Admin Test Widget')).toHaveCount(0, { timeout: 20000 });
});

test('verifying a store is recorded without needing a reason', async () => {
  await go(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.waitForLoadState('load');

  await page.getByTestId('toggle-verify').click();
  await expect(page.getByTestId('audit-action').first()).toHaveText(/VERIFY_SHOP|UNVERIFY_SHOP/, {
    timeout: 20000,
  });
});

test('a non-admin cannot reach any admin page', async ({ browser }) => {
  // Its own context: a different identity, and a fresh cookie jar.
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await login(sellerPage, 'adminowner@example.com'); // a seller, not an admin
  for (const path of ['/admin', '/admin/stores', '/admin/kyc']) {
    await go(sellerPage, `${BASE}${path}`);
    await sellerPage.waitForLoadState('load');
    // Redirected away rather than shown the page.
    expect(new URL(sellerPage.url()).pathname).not.toBe(path);
  }
  await sellerContext.close();
});
