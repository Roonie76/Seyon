import { expect, test } from '@playwright/test';

// Relies on `prisma db seed` data: shop "gadget-central" with the
// "mechanical-keychron-k2-keyboard" product.

test.describe('Buyer journey', () => {
  test('storefront renders shop identity and order CTA', async ({ page }) => {
    await page.goto('/store/gadget-central');

    await expect(page.getByRole('heading', { name: /gadget central/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /chat on whatsapp/i }).first()).toBeVisible();
    // Structured data present
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toContain('OnlineStore');
  });

  test('product page shows price, CTA, and breadcrumb trail', async ({ page }) => {
    await page.goto('/store/gadget-central/mechanical-keychron-k2-keyboard');

    await expect(page.getByRole('heading', { name: /keychron/i })).toBeVisible();
    await expect(page.getByText(/₹/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /chat on whatsapp|ask when/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to storefront/i })).toBeVisible();
  });

  test('marketplace filters update the URL', async ({ page }) => {
    await page.goto('/marketplace');

    await page.getByLabel(/sort by/i).selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);

    await page.getByText(/in stock only/i).click();
    await expect(page).toHaveURL(/inStock=1/);
  });

  test('unknown routes show the branded 404 page', async ({ page }) => {
    const res = await page.goto('/definitely-not-a-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/page not found/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /browse marketplace/i })).toBeVisible();
  });

  test('health endpoint reports database status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('up');
  });
});
