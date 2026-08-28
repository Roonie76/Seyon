import { test, expect } from '@playwright/test';

/**
 * Pagination, exercised through a real click.
 *
 * This is here because the bug it guards was invisible to every other kind of
 * check. The links were in the HTML, each page returned 200, and the server
 * rendered the right posts -- so curl and the unit tests all passed. What was
 * broken was a client effect: the sidebar search box ran its debounce on mount,
 * stripped `page` from the query and pushed, four hundred milliseconds after
 * every load. Only clicking the control in a browser and waiting shows it.
 */

const dismissOverlays = async (page: import('@playwright/test').Page) => {
  const ack = page.getByRole('button', { name: /Acknowledge/i });
  if (await ack.count()) await ack.first().click().catch(() => {});
  const consent = page.getByRole('button', { name: /No thanks|That's fine/i });
  if (await consent.count()) await consent.first().click().catch(() => {});
};

const firstCardTitle = (page: import('@playwright/test').Page) =>
  page.locator('article h3').first().innerText();

test.describe('blog pagination', () => {
  // Every case here navigates between server-rendered routes that are
  // force-dynamic, so a cold compile can take tens of seconds. The assertions
  // are fast; the waiting is the environment.
  test.slow();

  test('each page link loads a different set of articles', async ({ page }) => {
    await page.goto('/blog');
    await dismissOverlays(page);
    await expect(page.locator('article').first()).toBeVisible();

    const titles = new Set<string>();
    titles.add(await firstCardTitle(page));

    for (const n of [2, 3]) {
      await page.getByRole('link', { name: `Page ${n}` }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]page=${n}\\b`), { timeout: 30_000 });
      await expect(page.locator('article').first()).toBeVisible({ timeout: 30_000 });
      titles.add(await firstCardTitle(page));
    }

    // Three clicks, three different pages of content.
    expect(titles.size).toBe(3);
  });

  test('the page number survives the search box mounting', async ({ page }) => {
    // The debounce is 400ms; wait comfortably past it.
    await page.goto('/blog?page=2');
    await dismissOverlays(page);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/[?&]page=2\b/, { timeout: 30_000 });
  });

  test('searching resets to the first page and filters', async ({ page }) => {
    await page.goto('/blog?page=2');
    await dismissOverlays(page);
    await page.locator('input[placeholder="SEARCH ARTICLES..."]').fill('silver');
    await expect(page).toHaveURL(/[?&]q=silver/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/[?&]page=/);
  });

  test('a malformed page number does not error the route', async ({ page }) => {
    for (const bad of ['0', '-1', 'abc']) {
      const res = await page.goto(`/blog?page=${bad}`);
      expect(res?.status(), `?page=${bad}`).toBe(200);
      await expect(page.locator('article').first()).toBeVisible();
    }
  });
});
