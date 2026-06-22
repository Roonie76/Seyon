import { chromium } from '@playwright/test';

async function main() {
  console.log('Launching browser to capture verification screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // 1. Capture Marketplace Search Results for 'perfume'
  console.log('Navigating to marketplace search results...');
  await page.goto('http://localhost:3000/?q=Eau', { waitUntil: 'networkidle' });
  
  // Wait a moment for any layout animations or client-side renders
  await page.waitForTimeout(2000);
  
  const searchScreenshotPath = 'C:/Users/Rohin Vengatesh/.gemini/antigravity-ide/brain/d0178af4-3762-4114-bc69-cfcf63ce6a45/perfume_marketplace_grid_verification.png';
  await page.screenshot({ path: searchScreenshotPath, fullPage: true });
  console.log(`Marketplace search screenshot saved to: ${searchScreenshotPath}`);

  // 2. Capture Aroma Palace Storefront
  console.log('Navigating to Aroma Palace storefront...');
  await page.goto('http://localhost:3000/store/aroma-palace', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const storefrontScreenshotPath = 'C:/Users/Rohin Vengatesh/.gemini/antigravity-ide/brain/d0178af4-3762-4114-bc69-cfcf63ce6a45/perfume_storefront_grid_verification.png';
  await page.screenshot({ path: storefrontScreenshotPath, fullPage: true });
  console.log(`Storefront screenshot saved to: ${storefrontScreenshotPath}`);

  await browser.close();
  console.log('Verification screenshot capturing completed successfully!');
}

main().catch(console.error);
