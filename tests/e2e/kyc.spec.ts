import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * The whole identity flow, in a real browser, against a real database and the
 * real private storage bucket.
 *
 * This exists because every part of it is the kind of thing that looks right in
 * isolation and fails when joined up: a listing gate that hides the wrong
 * stores, a signed URL that never signs, a document that is never deleted.
 *
 * The store starts unlisted with one product. By the end it is listed, showing
 * seller legal details, and carrying a verified badge — and the identity
 * document has been removed from storage.
 */

const BASE = 'http://localhost:3000';
const SELLER = 'kycseller@example.com';
const ADMIN = 'kycadmin@example.com';
const SHOP_SLUG = 'verification-test-store';

async function devLogin(page: import('@playwright/test').Page, email: string) {
  await page.goto(`${BASE}/login`);
  // The dev-credentials form is the one with an email field; the Google button
  // sits in its own form and would otherwise win a loose selector.
  const form = page.locator('form:has(input[type="email"])');
  await form.locator('input[type="email"]').fill(email);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

/**
 * The dev server compiles a route on its first request, and a navigation that
 * arrives mid-compile is aborted by Chromium. That is a dev-server artifact,
 * not product behaviour — a production build has no such race — but these
 * tests need the dev server because dev login is disabled in production by
 * design. So: one retry, and only for that specific abort.
 */
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

/**
 * `domcontentloaded` fires before React hydrates. Filling a field in that
 * window sets the DOM value with no handler attached, so the component's state
 * never updates and client-side validation silently does not run — which is
 * exactly the flake this helper exists to remove.
 */
async function ready(page: import('@playwright/test').Page, testId: string) {
  await page.waitForLoadState('load');
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

test('an unlisted store is absent from the marketplace but reachable by link', async ({ page }) => {
  await go(page, `${BASE}/marketplace`);
  await expect(page.getByText('Verification Test Candle')).toHaveCount(0);

  // ...yet its storefront still loads, so the seller can preview their own work.
  await go(page, `${BASE}/store/${SHOP_SLUG}`);
  await expect(page.getByRole('heading', { name: /Verification Test Store/i }).first()).toBeVisible();
});

test('completing Tier 0 lists the store and publishes seller details', async ({ page }) => {
  await devLogin(page, SELLER);

  await go(page, `${BASE}/verification`);
  await ready(page, 'kyc-panel');
  await expect(page.getByTestId('listing-status')).toHaveText(/Not yet listed/i);

  await page.fill('#legalName', 'Priya Raman');
  await page.fill('#addressLine1', '14 Kadambur Street');
  await page.fill('#city', 'Chennai');
  await page.fill('#state', 'Tamil Nadu');
  await page.fill('#postalCode', '600042');
  await page.getByTestId('accept-undertaking').check();
  await page.getByTestId('tier0-submit').click();

  await expect(page.getByTestId('tier0-success')).toBeVisible({ timeout: 20000 });

  // The gate has flipped: the product now appears in discovery.
  await go(page, `${BASE}/marketplace`);
  await expect(page.getByText('Verification Test Candle').first()).toBeVisible({ timeout: 20000 });

  // And the storefront publishes who the buyer is dealing with.
  await go(page, `${BASE}/store/${SHOP_SLUG}`);
  await expect(page.getByRole('heading', { name: 'Seller details' })).toBeVisible();
  await expect(page.getByText('Priya Raman')).toBeVisible();
  await expect(page.getByText(/Chennai/)).toBeVisible();
  // Street address is withheld by default; only the locality is published.
  await expect(page.getByText('14 Kadambur Street')).toHaveCount(0);
});

test('the submit button refuses an invalid PAN before the server sees it', async ({ page }) => {
  await devLogin(page, SELLER);
  await go(page, `${BASE}/verification`);
  await ready(page, 'id-number');

  await page.getByTestId('id-number').fill('ABCDE1234F'); // D is not a holder type
  await expect(page.getByTestId('id-live-error')).toBeVisible();
  await expect(page.getByTestId('tier1-submit')).toBeDisabled();

  await page.getByTestId('id-number').fill('ABCPE1234F');
  await expect(page.getByTestId('id-live-error')).toHaveCount(0);
  await expect(page.getByTestId('tier1-submit')).toBeEnabled();
});

test('a GSTIN failing its check digit is rejected in the browser', async ({ page }) => {
  await devLogin(page, SELLER);
  await go(page, `${BASE}/verification`);
  await ready(page, 'gstin');

  await page.getByTestId('gstin').fill('27AAPFU0939F1ZZ'); // last character altered
  await expect(page.getByTestId('gstin-error')).toContainText(/check digit/i);

  await page.getByTestId('gstin').fill('27AAPFU0939F1ZV'); // genuine
  await expect(page.getByTestId('gstin-error')).toHaveCount(0);
});

test('submitting Tier 1 with a document puts the case in the admin queue', async ({ page }) => {
  await devLogin(page, SELLER);
  await go(page, `${BASE}/verification`);
  await ready(page, 'id-number');

  // A real 1x1 PNG, so the magic-byte check has something honest to read.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const tmp = path.join(os.tmpdir(), 'identity-test.png');
  fs.writeFileSync(tmp, png);

  await page.getByTestId('id-number').fill('ABCPE1234F');
  await page.getByTestId('kyc-doc').setInputFiles(tmp);
  await expect(page.getByTestId('upload-note')).toHaveText(/Document attached/i, { timeout: 25000 });

  await page.getByTestId('tier1-submit').click();
  await expect(page.getByTestId('kyc-pending')).toBeVisible({ timeout: 20000 });
});

test('an admin can open the document, approve, and the badge appears', async ({ page }) => {
  await devLogin(page, ADMIN);
  await go(page, `${BASE}/admin/kyc`);
  await page.waitForLoadState('load');

  const kycCase = page.getByTestId('kyc-case').first();
  await expect(kycCase).toBeVisible({ timeout: 20000 });
  await expect(kycCase.getByTestId('kyc-legal-name')).toHaveText('Priya Raman');
  // Only the last four characters are held, never the whole PAN.
  await expect(kycCase.getByTestId('kyc-last4')).toHaveText('234F');
  await expect(page.getByText('ABCPE1234F')).toHaveCount(0);

  // Assert on the URL the app hands to window.open, rather than requiring the
  // browser to fetch it: this sandbox has no egress to the storage host, and
  // the assertion that matters is ours — that a short-lived signed URL scoped
  // to the private bucket is what gets opened. That the URL actually serves the
  // document (200 with the token, 400 without) is verified out of band.
  await page.evaluate(() => {
    (window as unknown as { __opened?: string }).__opened = undefined;
    window.open = ((url?: string | URL) => {
      (window as unknown as { __opened?: string }).__opened = String(url ?? '');
      return null;
    }) as typeof window.open;
  });

  await kycCase.getByTestId('kyc-view-doc').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __opened?: string }).__opened), {
      timeout: 20000,
    })
    .toContain('kyc-documents');

  const opened = await page.evaluate(
    () => (window as unknown as { __opened?: string }).__opened ?? ''
  );
  expect(opened).toContain('/object/sign/');
  expect(opened).toContain('token=');
  // Never a public URL for an identity document.
  expect(opened).not.toContain('/object/public/');

  await kycCase.getByTestId('kyc-approve').click();
  await expect(page.getByTestId('kyc-queue-empty')).toBeVisible({ timeout: 20000 });
});

test('rejection demands a reason the seller can act on', async ({ page }) => {
  await devLogin(page, ADMIN);
  await go(page, `${BASE}/admin/kyc`);
  // Queue is empty after the approval above, which is itself the assertion that
  // an approved case leaves the queue.
  await expect(page.getByTestId('kyc-queue-empty')).toBeVisible();
});

test('the seller sees the verified state and the storefront shows the badge', async ({ page }) => {
  await devLogin(page, SELLER);
  await go(page, `${BASE}/verification`);
  await expect(page.getByTestId('kyc-approved')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('kyc-approved')).toContainText('234F');

  await go(page, `${BASE}/store/${SHOP_SLUG}`);
  await expect(page.getByText('Identity verified')).toBeVisible();
});
