import { expect, test } from '@playwright/test';

test('buyer can browse marketplace and search without a broken shell', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page.getByRole('heading', { name: /discover seyon marketplace/i })).toBeVisible();
  await expect(page.getByPlaceholder(/search products/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /search/i })).toBeVisible();

  await page.getByPlaceholder(/search products/i).fill('keyboard');
  await page.getByRole('button', { name: /search/i }).click();

  await expect(page).toHaveURL(/\/marketplace\?q=keyboard/);
  await expect(page.getByText(/showing/i)).toBeVisible();
});
