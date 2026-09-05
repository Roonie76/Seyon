/**
 * The seller pipeline, end to end, in a real browser against a real database.
 *
 * Sign up -> create a store -> verify the number -> submit identity -> listed
 * -> discoverable. Everything the production pipeline does except the call to
 * Meta, which needs an approved template and cannot be exercised from here.
 */
import { chromium } from 'playwright';
import pg from 'pg';
import fs from 'node:fs';

// One server, two host names. `SELLER_HOSTS` contains 127.0.0.1:3000, so the
// middleware treats that name as the seller platform and localhost:3000 as the
// buyer marketplace — the same split production runs across two domains.
const SELLER = 'http://127.0.0.1:3000';
const BUYER = 'http://localhost:3000';
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);

const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();

const stamp = Date.now();
const EMAIL = `pipeline-${stamp}@example.com`;
const SLUG = `probe-store-${stamp}`;
const NAME = `Probe Store ${stamp}`;
const NAME_MARKER = NAME;
const WHATSAPP = '+919700000123';

const results = [];
function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: 'direct://' },
  args: ['--no-proxy-server'],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  // ---------- 1. sign up ----------
  await page.goto(`${SELLER}/sell`, { waitUntil: 'domcontentloaded' });
  const signIn = await page.evaluate(async (email) => {
    const csrf = await (await fetch('/api/auth/csrf', { credentials: 'include' })).json();
    await fetch('/api/auth/callback/credentials', {
      method: 'POST', credentials: 'include', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: 'x', redirect: 'false', callbackUrl: '/' }).toString(),
    });
    return (await (await fetch('/api/auth/session', { credentials: 'include' })).json());
  }, EMAIL);
  step('sign up creates an account and a session', Boolean(signIn?.user?.id), `role ${signIn?.user?.role}`);
  const userId = signIn?.user?.id;
  if (!userId) throw new Error('no session — cannot continue');

  // ---------- 2. create the store ----------
  await page.goto(`${SELLER}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="e.g. Gadget Central"]', { timeout: 45000 });

  /**
   * Fill after hydration, and prove it stuck.
   *
   * The dashboard streams, so the inputs exist in the HTML before React has
   * taken them over. Typing into them in that window looks like it worked and
   * is then wiped when the client component mounts with its own empty state —
   * the form submitted with a blank name and the browser's own "please fill
   * out this field" swallowed it, which is why no row appeared and no error
   * did either.
   */
  async function fillStable(selector, value) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await page.fill(selector, value);
      await page.waitForTimeout(400);
      if ((await page.inputValue(selector)) === value) return;
    }
    throw new Error(`could not get ${selector} to hold a value — the field keeps resetting`);
  }

  /**
   * Wait for React to actually own the form before filling it.
   *
   * Verifying that a value stuck is not enough: hydration can land *after* the
   * check and reset every controlled input to its empty initial state, which
   * is what made this probe intermittently submit a blank name. The reliable
   * signal is behaviour only the client component provides — typing a name
   * derives the URL handle — so the probe types, watches for the handle to
   * appear, and only then fills the real values.
   */
  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 30) throw new Error('the store form never hydrated');
    await page.fill('input[placeholder="e.g. Gadget Central"]', 'hydration probe');
    await page.waitForTimeout(500);
    if ((await page.inputValue('input[placeholder="e.g. gadget-central"]')) === 'hydration-probe') break;
  }

  await fillStable('input[placeholder="e.g. Gadget Central"]', NAME);
  await fillStable('input[placeholder="e.g. gadget-central"]', SLUG);
  await fillStable('textarea[placeholder^="Tell buyers"]', 'Hand-block printed cotton, made in Jaipur.');
  await fillStable('input[placeholder^="e.g. +15551234567"]', WHATSAPP);
  await fillStable('input[placeholder="e.g. Chennai"]', 'Chennai');
  await fillStable('input[placeholder="e.g. Tamil Nadu"]', 'Tamil Nadu');
  const deploy = page.locator('button', { hasText: /Deploy Shop Catalog/ }).first();
  await deploy.waitFor({ state: 'visible', timeout: 30000 });
  await deploy.click();
  await page.waitForTimeout(5000);

  const diag = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Deploy Shop Catalog|Creating Storefront/.test(b.textContent || ''));
    const f = btn ? btn.closest('form') : document.querySelector('form');
    return {
      url: location.href,
      btnText: (btn?.textContent ?? '(no deploy button)').trim(),
      invalid: Array.from(f?.querySelectorAll('input,textarea,select') ?? [])
        .filter((el) => !el.checkValidity())
        .map((el) => `${el.name || el.id || el.placeholder}: ${el.validationMessage}`),
      firstChild: (f?.firstElementChild?.textContent ?? '').trim().slice(0, 200),
      formHead: (f?.innerText ?? '').trim().slice(0, 200),
    };
  }).catch((e) => ({ error: String(e) }));
  // Printed only when the store is missing — otherwise it is noise.

  let shop = (await db.query('select * from "Shop" where slug = $1', [SLUG])).rows[0];
  if (!shop) console.log('      diag:', JSON.stringify(diag).slice(0, 400));
  step('the store row is created', Boolean(shop), shop ? `id ${shop.id}` : 'no row');
  if (!shop) throw new Error('store was not created');

  const role = (await db.query('select role from "User" where id = $1', [userId])).rows[0]?.role;
  step('the buyer is promoted to SELLER in the database', role === 'SELLER', `role ${role}`);
  step('the store starts unlisted, as it must', shop.isListed === false, `isListed ${shop.isListed}`);
  step('the WhatsApp number is normalised on the way in', shop.whatsapp === WHATSAPP, shop.whatsapp);

  // ---------- 3. request a verification code ----------
  await page.goto(`${SELLER}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const sendBtn = page.locator('button', { hasText: /Send Code|Reverify/ }).first();
  await sendBtn.waitFor({ timeout: 30000 });
  await sendBtn.click();
  await page.waitForTimeout(3500);

  const banner = await page.locator('text=/Dev code:|code went to your email|Verification code sent/').first().textContent().catch(() => null);
  const devCode = banner && banner.match(/Dev code:\s*(\d{6})/)?.[1];
  const attempt = (await db.query('select * from "WhatsappVerification" where "shopId"=$1 order by "createdAt" desc limit 1', [shop.id])).rows[0];
  step('a verification attempt is recorded', Boolean(attempt), attempt ? `deliveredVia ${attempt.deliveredVia}` : 'none');
  step('the dev path hands back a code so the flow is testable', Boolean(devCode), devCode ? `code ${devCode}` : `banner: ${String(banner).slice(0, 90)}`);

  if (devCode) {
    await page.fill('input[placeholder="6-digit code"]', devCode);
    await page.locator('button', { hasText: /^Confirm|Verify$/ }).first().click();
    await page.waitForTimeout(3500);
    shop = (await db.query('select * from "Shop" where id=$1', [shop.id])).rows[0];
    step('confirming the code marks the number verified', Boolean(shop.whatsappVerifiedAt), `via ${shop.whatsappVerifiedVia}`);
    step('a code that arrived by email is recorded as EMAIL, not WHATSAPP',
      shop.whatsappVerifiedVia === 'EMAIL',
      `via ${shop.whatsappVerifiedVia} — this is the wall the production pipeline hits`);
  }


  /** Same hydration race as the store form: tick it, then prove React noticed. */
  async function acceptUndertaking() {
    const box = page.locator('[data-testid="accept-undertaking"]');
    const submit = page.locator('[data-testid="tier0-submit"]');
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await box.isChecked())) await box.check({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      if (await box.isChecked() && await submit.isEnabled()) return;
    }
    throw new Error('the undertaking checkbox never enabled the submit button');
  }

  // ---------- 4. Tier 0 must refuse an email-only verification ----------
  await page.goto(`${SELLER}/verification`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#legalName', { timeout: 60000 });
  await page.waitForTimeout(2500);
  const emailOnlyWarning = await page.locator('[data-testid="whatsapp-email-only-warning"]').count();
  step('the panel warns that an emailed code is not enough', emailOnlyWarning === 1);

  await page.fill('#legalName', 'Probe Seller');
  await page.fill('#addressLine1', '12 Nungambakkam High Road');
  await page.fill('#city', 'Chennai');
  await page.fill('#state', 'Tamil Nadu');
  await page.fill('#postalCode', '600034');
  await acceptUndertaking();
  await page.click('[data-testid="tier0-submit"]');
  await page.waitForTimeout(3000);

  const refusal = await page.locator('[data-testid="tier0-error"]').textContent().catch(() => null);
  shop = (await db.query('select * from "Shop" where id=$1', [shop.id])).rows[0];
  step('Tier 0 refuses an email-only verification', Boolean(refusal) && shop.isListed === false,
    refusal ? refusal.slice(0, 80) : 'no refusal shown');

  // ---------- 5. simulate a real WhatsApp delivery, then finish ----------
  // Only the channel is changed. Everything after this is the real code path,
  // exercised in the state a working Meta template would have produced.
  await db.query(`update "Shop" set "whatsappVerifiedVia"='WHATSAPP' where id=$1`, [shop.id]);

  await page.goto(`${SELLER}/verification`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#legalName', { timeout: 60000 });
  await page.waitForTimeout(2500);
  step('the email-only warning clears once the channel is WhatsApp',
    (await page.locator('[data-testid="whatsapp-email-only-warning"]').count()) === 0);

  await page.fill('#legalName', 'Probe Seller');
  await page.fill('#addressLine1', '12 Nungambakkam High Road');
  await page.fill('#city', 'Chennai');
  await page.fill('#state', 'Tamil Nadu');
  await page.fill('#postalCode', '600034');
  await acceptUndertaking();
  await page.click('[data-testid="tier0-submit"]');
  await page.waitForTimeout(4000);

  shop = (await db.query('select * from "Shop" where id=$1', [shop.id])).rows[0];
  const kyc = (await db.query('select * from "SellerKyc" where "userId"=$1', [userId])).rows[0];
  step('Tier 0 accepts and lists the store', shop.isListed === true, `isListed ${shop.isListed}`);
  step('the identity record is written with the undertaking', Boolean(kyc?.undertakingAt), kyc ? `tier ${kyc.tier}` : 'none');
  step('the address is saved on the account', Boolean((await db.query('select "addressLine1" from "User" where id=$1', [userId])).rows[0]?.addressLine1));

  // ---------- 6. is it actually discoverable? ----------
  const storeRes = await page.goto(`${BUYER}/store/${SLUG}`, { waitUntil: 'domcontentloaded' });
  step('the storefront page renders', storeRes?.status() === 200, `status ${storeRes?.status()}`);
  const storeHasName = await page.locator(`text=${NAME}`).count();
  step('the storefront shows the store name', storeHasName > 0);

  // /marketplace is a redirect to the homepage, so go straight there and give
  // the rails time to render before deciding the store is missing.
  await page.goto(`${BUYER}/`, { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  const inMarket = await page.locator(`text=${NAME}`).count();
  const bodyHasIt = (await page.evaluate(() => document.body.innerText)).includes(NAME_MARKER);
  step('a listed store with no products appears on the marketplace home', inMarket > 0 || bodyHasIt,
    (inMarket > 0 || bodyHasIt) ? '' : 'absent — the rails are built from active products, so an empty store has nothing to show');

  const sitemap = await (await fetch(`${BUYER}/sitemap.xml`)).text();
  step('the store is in the sitemap', sitemap.includes(SLUG));

} catch (e) {
  step('the run completed without throwing', false, e instanceof Error ? e.message : String(e));
} finally {
  await page.screenshot({ path: 'pipeline-final.png', fullPage: false }).catch(() => {});
  await browser.close();
  // Leave nothing behind.
  await db.query('delete from "WhatsappVerification" where "shopId" in (select id from "Shop" where slug=$1)', [SLUG]);
  await db.query('delete from "Shop" where slug=$1', [SLUG]);
  await db.query('delete from "SellerKyc" where "userId" in (select id from "User" where email=$1)', [EMAIL]);
  await db.query('delete from "Account" where "userId" in (select id from "User" where email=$1)', [EMAIL]);
  await db.query('delete from "User" where email=$1', [EMAIL]);
  await db.end();
}

console.log('');
if (consoleErrors.length) {
  console.log(`browser console errors (${consoleErrors.length}):`);
  for (const e of [...new Set(consoleErrors)].slice(0, 6)) console.log(`  ${e.slice(0, 140)}`);
  console.log('');
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} steps passed.`);
process.exit(failed.length ? 1 : 0);
