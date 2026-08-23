/**
 * Browser-level regression tests for the August 2026 adversarial audit.
 *
 * Expected RED until the corresponding defect is fixed.
 *
 * Requires: a seeded database, a seller account with a shop, and
 * ALLOW_INSECURE_DEV_LOGIN=true for the passwordless test login.
 *
 *   SELLER_EMAIL=seller1@audit.test npx playwright test tests/e2e/audit-regression.spec.ts
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';

const SELLER_EMAIL = process.env.SELLER_EMAIL || 'seller1@audit.test';
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
  'hex'
);

async function mockUpload(ctx: BrowserContext) {
  await ctx.route('**/api/upload', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&u=${Date.now()}`,
      }),
    })
  );
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', SELLER_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|marketplace|\/$/);
}

async function openAddProduct(page: Page, title: string, price = '199') {
  await page.goto('/dashboard/products');
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector('input[placeholder*="Mechanical Keyboard"]');
  await page.fill('input[placeholder*="Mechanical Keyboard"]', title);
  await page.fill('input[placeholder*="e.g. 1500"]', price);
  await page.selectOption('select >> nth=0', 'Fashion');
  const files = page.locator('input[type=file]');
  await files.nth((await files.count()) - 1).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('text=Product Images (1)')).toBeVisible();
}

test.describe('F-03 double submit must never create two products', () => {
  test('re-clicking Deploy inside the success window does not duplicate', async ({ page, context }) => {
    await mockUpload(context);
    await login(page);
    const title = `Dupe Guard ${Date.now()}`;
    await openAddProduct(page, title);

    const submit = page.locator('button:has-text("Deploy Listing")');
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.headers()['next-action']) posts.push(r.url());
    });

    await submit.click();
    await expect(page.locator('text=Product created successfully!')).toBeVisible();

    // The button must stay disabled for as long as the success dialog is open.
    await expect(submit).toBeDisabled();
    await submit.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(2000);

    expect(posts.length, 'exactly one create request must be sent').toBe(1);

    await page.goto('/dashboard/products');
    await expect(page.locator(`tbody tr:has-text("${title}")`)).toHaveCount(1);
  });
});

test.describe('F-08 a failed mutation must surface an error and re-enable the form', () => {
  test('network failure during create shows an error and does not hang', async ({ page, context }) => {
    await mockUpload(context);
    await login(page);
    await openAddProduct(page, `Net Fail ${Date.now()}`);

    await page.route('**/dashboard/products', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionfailed') : route.continue()
    );

    await page.locator('button:has-text("Deploy Listing")').click();

    // An error must be shown to the seller...
    await expect(page.locator('div.bg-red-50')).toBeVisible({ timeout: 10_000 });
    // ...and the form must become usable again so they can retry.
    await expect(page.locator('button:has-text("Deploy Listing")')).toBeEnabled();
  });
});

test.describe('F-15 missing storefront resources must return HTTP 404', () => {
  test('unknown shop returns 404', async ({ request }) => {
    expect((await request.get('/store/definitely-not-a-shop')).status()).toBe(404);
  });

  test('unknown product returns 404', async ({ request, baseURL }) => {
    expect((await request.get('/store/audit-shop/definitely-not-a-product')).status()).toBe(404);
  });
});

test.describe('F-02 a single product must never be able to break a shared page', () => {
  test('homepage stays healthy regardless of catalogue contents', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status(), 'homepage must not 500 because of one product row').toBe(200);
  });

  test('seller product dashboard stays reachable', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/products');
    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
    await expect(page.locator('h1:has-text("Product Catalog")')).toBeVisible();
  });
});

test.describe('F-07 products created with a non-Latin title must be reachable', () => {
  test('a Tamil-titled product has a working storefront URL', async ({ page, context }) => {
    await mockUpload(context);
    await login(page);
    const title = 'மணிமாலை நகை';
    await openAddProduct(page, title);
    await page.locator('button:has-text("Deploy Listing")').click();
    await expect(page.locator('text=Product created successfully!')).toBeVisible();

    await page.goto('/dashboard/products');
    const row = page.locator(`tbody tr:has-text("${title}")`).first();
    await expect(row).toBeVisible();

    // The share link for that row must resolve to the product page, not the store page.
    await page.goto('/store/audit-shop');
    const link = page.locator(`a[href^="/store/audit-shop/"]`).filter({ hasText: title }).first();
    const href = await link.getAttribute('href');
    expect(href, 'slug must not be empty or a bare hyphen').not.toMatch(/\/store\/[^/]+\/-?\d*$/);
  });
});
