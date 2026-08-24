import { test, expect, type Page, type Browser } from '@playwright/test';

/**
 * Moderation, complaints, notices and access — in a real browser.
 *
 * The assertions that earn their place here are the ones that cross a boundary:
 * hiding a review in the admin screen and then checking the *public* storefront
 * for the rating and the text; placing a store under review and then checking
 * the *marketplace* for its absence; sending a notice as an admin and then
 * reading it as the seller. Each of those spans two sessions and three layers,
 * which is exactly where a `where` clause gets forgotten.
 */

const BASE = 'http://localhost:3000';
const ADMIN = 'admintest@example.com';
const OWNER = 'adminowner@example.com';
const SHOP_SLUG = 'admin-test-store';

async function go(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return;
    } catch (err) {
      // The dev server aborts the first request to a route it has not compiled
      // yet. Only that error is retried; anything else is a real failure.
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

/** Like `go`, but hands back the response so a status code can be asserted. */
async function goStatus(page: Page, url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return res;
    } catch (err) {
      if (!String(err).includes('ERR_ABORTED') || attempt === 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
  return null;
}

async function ready(page: Page, url: string) {
  await go(page, url);
  await page.waitForLoadState('load');
}

test.describe.configure({ mode: 'serial' });

// One login for the suite: LOGIN is rate limited to five per minute per email,
// and re-authenticating for every test trips it — correctly.
let page: Page;
let browser: Browser;

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  page = await b.newPage();
  await login(page, ADMIN);
});

test.afterAll(async () => {
  await page?.close();
});

/* ------------------------------------------------------------------ reviews */

test('a review cannot be hidden without a reason', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);

  await expect(page.getByTestId('review-list')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('review-row')).toHaveCount(3);
  await expect(page.getByTestId('review-row-hidden')).toHaveCount(0);

  // The one-star review is the last of the three.
  const target = page.getByTestId('review-row').filter({ hasText: 'fraud and steals' });
  await target.getByTestId('hide-review').click();
  await expect(target.getByTestId('hide-review-confirm')).toBeDisabled();

  await target.getByTestId('hide-review-reason').fill('too short');
  await expect(target.getByTestId('hide-review-confirm')).toBeDisabled();
});

test('hiding a review records who did it and why, and does not delete it', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);

  const target = page.getByTestId('review-row').filter({ hasText: 'fraud and steals' });
  await target.getByTestId('hide-review').click();
  await target.getByTestId('hide-review-reason').fill('Accusation of theft with no order behind it; reporter never contacted this seller.');
  await expect(target.getByTestId('hide-review-confirm')).toBeEnabled();
  await target.getByTestId('hide-review-confirm').click();

  const hidden = page.getByTestId('review-row-hidden');
  await expect(hidden).toHaveCount(1, { timeout: 20000 });
  // The comment is still there — that is the difference between hiding and
  // deleting, and the reason the decision can be reviewed later.
  await expect(hidden).toContainText('fraud and steals');
  await expect(hidden.getByTestId('review-hidden-reason')).toContainText('Accusation of theft');
  await expect(hidden.getByTestId('review-hidden-reason')).toContainText('Admin Tester');
});

test('the hidden review is gone from the public storefront, and the rating has moved', async () => {
  // A fresh context with no session: this is what a shopper sees.
  const shopper = await browser.newContext();
  const shopperPage = await shopper.newPage();
  await ready(shopperPage, `${BASE}/store/${SHOP_SLUG}`);

  const body = shopperPage.locator('body');
  await expect(body).toContainText('Fast replies');
  await expect(shopperPage.getByText('fraud and steals')).toHaveCount(0);

  // 5, 5, 1 averages 3.7. With the 1 hidden it is 5.0. If the rating still
  // reads 3.7 the review is invisible but still counted, which is worse than
  // not having hidden it at all.
  await expect(body).toContainText('5.0');
  await expect(shopperPage.getByText('3.7')).toHaveCount(0);

  await shopper.close();
});

test('showing it again restores both the review and the rating', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.getByTestId('review-row-hidden').getByTestId('unhide-review').click();
  await expect(page.getByTestId('review-row-hidden')).toHaveCount(0, { timeout: 20000 });

  const shopper = await browser.newContext();
  const shopperPage = await shopper.newPage();
  await ready(shopperPage, `${BASE}/store/${SHOP_SLUG}`);
  await expect(shopperPage.locator('body')).toContainText('3.7');
  await shopper.close();
});

/* -------------------------------------------------------------- under review */

test('a store under review leaves the marketplace but keeps its direct link', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);

  await page.getByTestId('under-review-open').click();
  await expect(page.getByTestId('under-review-confirm')).toBeDisabled();
  await page.getByTestId('under-review-reason').fill('Two counterfeit complaints in three days; checking the supplier paperwork.');
  await expect(page.getByTestId('under-review-confirm')).toBeEnabled();
  await page.getByTestId('under-review-confirm').click();

  await expect(page.getByTestId('under-review-status')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('under-review-status')).toContainText('counterfeit complaints');

  const shopper = await browser.newContext();
  const shopperPage = await shopper.newPage();

  // Gone from discovery. `/` rather than `/marketplace`: the marketplace route
  // is now a redirect to the homepage, which is where the discovery rails
  // actually live, and navigating to the old path would silently test the
  // redirect instead of the filter.
  await ready(shopperPage, `${BASE}/`);
  await expect(shopperPage.getByText('Admin Test Store')).toHaveCount(0);

  // ...but the storefront itself still works, and says nothing about it. A
  // banner here would convict a seller on an untested accusation.
  const res = await goStatus(shopperPage, `${BASE}/store/${SHOP_SLUG}`);
  expect(res?.status()).toBe(200);
  await shopperPage.waitForLoadState('load');
  await expect(shopperPage.locator('body')).toContainText('Admin Test Store');
  await expect(shopperPage.getByText(/under review/i)).toHaveCount(0);

  await shopper.close();
});

test('clearing the review puts the store back into the marketplace', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  await page.getByTestId('clear-under-review').click();
  await expect(page.getByTestId('under-review-open')).toBeVisible({ timeout: 20000 });

  const shopper = await browser.newContext();
  const shopperPage = await shopper.newPage();
  await ready(shopperPage, `${BASE}/`);
  await expect(shopperPage.getByText('Admin Test Store').first()).toBeVisible({ timeout: 20000 });
  await shopper.close();
});

/* --------------------------------------------------------------- complaints */

test('the queue counts what is past the 48-hour deadline', async () => {
  await ready(page, `${BASE}/admin/reports`);

  await expect(page.getByTestId('complaint-row').first()).toBeVisible({ timeout: 20000 });
  // One complaint was seeded three days old and never acknowledged.
  await expect(page.getByTestId('count-overdue-ack')).toHaveText('1');

  const overdue = page.getByTestId('complaint-row').filter({ hasText: 'counterfeit of a brand' });
  await expect(overdue.getByTestId('complaint-sla')).toContainText('past the deadline');
  await expect(overdue.getByTestId('severe-badge')).toBeVisible();
});

test('acknowledging stops the 48-hour clock without closing the complaint', async () => {
  await ready(page, `${BASE}/admin/reports`);

  const overdue = page.getByTestId('complaint-row').filter({ hasText: 'counterfeit of a brand' });
  await overdue.getByTestId('acknowledge').click();

  await expect(page.getByTestId('count-overdue-ack')).toHaveText('0', { timeout: 20000 });

  // Still in the open queue: acknowledged is not the same as dealt with.
  const still = page.getByTestId('complaint-row').filter({ hasText: 'counterfeit of a brand' });
  await expect(still.getByTestId('complaint-sla')).toContainText('Acknowledged');
  await expect(still.getByTestId('complaint-sla')).toContainText('after the 48-hour deadline');
});

test('closing a complaint demands a note, and the note is kept', async () => {
  await ready(page, `${BASE}/admin/reports`);

  const row = page.getByTestId('complaint-row').filter({ hasText: 'counterfeit of a brand' });
  await row.getByTestId('close-upheld').click();
  await expect(row.getByTestId('complaint-close-confirm')).toBeDisabled();

  await row.getByTestId('complaint-note').fill('short');
  await expect(row.getByTestId('complaint-close-confirm')).toBeDisabled();

  await row.getByTestId('complaint-note').fill('Listings removed and the seller asked for supplier invoices.');
  await expect(row.getByTestId('complaint-close-confirm')).toBeEnabled();
  await row.getByTestId('complaint-close-confirm').click();

  // Gone from the open queue...
  await expect(page.getByText('counterfeit of a brand')).toHaveCount(0, { timeout: 20000 });

  // ...and findable, with its note, under closed.
  await ready(page, `${BASE}/admin/reports?status=closed`);
  const closed = page.getByTestId('complaint-row').filter({ hasText: 'counterfeit of a brand' });
  await expect(closed.getByTestId('complaint-resolution')).toContainText('supplier invoices');
});

/* ------------------------------------------------------------------ notices */

test('a notice sent by an admin reaches the seller and is marked read', async () => {
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);

  await page.getByTestId('notice-compose-open').click();
  await page.getByTestId('notice-kind').selectOption('INFORMATION_REQUEST');
  await page.getByTestId('notice-subject-input').fill('Please send your supplier invoices');
  await expect(page.getByTestId('notice-send')).toBeDisabled();

  await page
    .getByTestId('notice-body-input')
    .fill('A buyer says the perfume is counterfeit. Send the invoices for that stock so we can close this.');
  await page.getByTestId('notice-requires-response').check();
  await expect(page.getByTestId('notice-send')).toBeEnabled();
  await page.getByTestId('notice-send').click();

  const sent = page.getByTestId('store-notice-item').filter({ hasText: 'supplier invoices' });
  await expect(sent).toBeVisible({ timeout: 20000 });
  // Email is not configured in the test environment, and that is the point:
  // the notice exists regardless.
  await expect(sent.getByTestId('notice-delivery')).toHaveText('unread');

  // Now as the seller.
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await login(sellerPage, OWNER);
  await ready(sellerPage, `${BASE}/notices`);

  const inboxItem = sellerPage.getByTestId('notice-item').filter({ hasText: 'supplier invoices' });
  await expect(inboxItem).toBeVisible({ timeout: 20000 });
  await expect(inboxItem.getByTestId('notice-unread')).toBeVisible();
  await expect(inboxItem.getByTestId('notice-body')).toContainText('Send the invoices');

  await inboxItem.getByTestId('notice-response-input').fill('Invoices attached on email, sent this morning from our supplier.');
  await inboxItem.getByTestId('notice-respond').click();
  await expect(inboxItem.getByTestId('notice-response')).toContainText('Invoices attached', { timeout: 20000 });

  await sellerContext.close();

  // And the admin can see that it landed and was answered.
  await ready(page, `${BASE}/admin/stores/${SHOP_SLUG}`);
  const seen = page.getByTestId('store-notice-item').filter({ hasText: 'supplier invoices' });
  await expect(seen.getByTestId('notice-delivery')).toContainText('read');
  await expect(seen.getByTestId('store-notice-response')).toContainText('Invoices attached');
});

/* ----------------------------------------------------------- access control */

test('an admin cannot remove their own admin access', async () => {
  await ready(page, `${BASE}/admin/access?q=admintest@example.com`);

  const self = page.getByTestId('access-row').filter({ hasText: 'admintest@example.com' });
  await expect(self.getByTestId('access-self')).toBeVisible({ timeout: 20000 });
  await expect(self.getByTestId('role-self-locked')).toBeVisible();
});

test('changing someone to admin requires a stated reason, and is recorded', async () => {
  await ready(page, `${BASE}/admin/access?q=${OWNER}`);

  const row = page.getByTestId('access-row').filter({ hasText: OWNER });
  await expect(row.getByTestId('access-role')).toHaveText('SELLER');

  await row.getByTestId('role-select').selectOption('ADMIN');
  await expect(row.getByTestId('role-confirm')).toBeDisabled();

  await row.getByTestId('role-reason').fill('short');
  await expect(row.getByTestId('role-confirm')).toBeDisabled();

  await row.getByTestId('role-reason').fill('Taking over weekend moderation while I am away.');
  await expect(row.getByTestId('role-confirm')).toBeEnabled();
  await row.getByTestId('role-confirm').click();

  await expect(page.getByTestId('access-row').filter({ hasText: OWNER }).getByTestId('access-role')).toHaveText(
    'ADMIN',
    { timeout: 20000 }
  );

  // The record that did not exist when roles were changed by hand in the database.
  await ready(page, `${BASE}/admin/access`);
  await expect(page.getByTestId('role-history')).toBeVisible();
  await expect(page.getByTestId('role-history-action').first()).toHaveText('GRANT_ADMIN');
  await expect(page.getByTestId('role-history')).toContainText('weekend moderation');
});

test('a role change back down is recorded too', async () => {
  await ready(page, `${BASE}/admin/access?q=${OWNER}`);
  const row = page.getByTestId('access-row').filter({ hasText: OWNER });
  await row.getByTestId('role-select').selectOption('SELLER');
  await row.getByTestId('role-reason').fill('Weekend cover finished; back to a seller account.');
  await row.getByTestId('role-confirm').click();

  await expect(page.getByTestId('access-row').filter({ hasText: OWNER }).getByTestId('access-role')).toHaveText(
    'SELLER',
    { timeout: 20000 }
  );

  await ready(page, `${BASE}/admin/access`);
  await expect(page.getByTestId('role-history-action').first()).toHaveText('REVOKE_ADMIN');
});

test('a seller cannot reach the new admin screens', async () => {
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await login(sellerPage, OWNER);

  for (const path of ['/admin/reports', '/admin/access']) {
    await ready(sellerPage, `${BASE}${path}`);
    expect(new URL(sellerPage.url()).pathname).not.toBe(path);
  }
  await sellerContext.close();
});
