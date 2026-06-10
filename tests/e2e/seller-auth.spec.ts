import { expect, test } from '@playwright/test';

// Dev-only credentials login is active when the dev server runs
// (NODE_ENV !== 'production'), so e2e can sign in without OAuth.

test.describe('Seller auth & dashboard', () => {
  test('login page offers dev email login and Google', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText(/email address \(dev login\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('dev login signs in and redirects away from /login', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/you@example\.com/i).fill('e2e-buyer@test.local');
    await page.getByRole('button', { name: /continue with email/i }).click();

    // Redirected to the callback target (marketplace on buyer host)
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    expect(page.url()).not.toContain('/login');
  });

  test('review submission is gated for users who never contacted the seller', async ({ page }) => {
    // Sign in as a fresh user with no WHATSAPP_CLICK history
    await page.goto('/login');
    await page.getByPlaceholder(/you@example\.com/i).fill(`e2e-gated-${Date.now()}@test.local`);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

    await page.goto('/store/gadget-central');
    const reviewButton = page.getByRole('button', { name: /write a review|leave a review|review/i }).first();
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
      await page.getByPlaceholder(/share your experience|comment/i).fill('Trying to review without contact');
      await page.getByRole('button', { name: /submit/i }).click();
      await expect(page.getByText(/contacted this seller/i)).toBeVisible();
    }
  });
});
