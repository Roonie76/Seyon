/**
 * Is production actually working right now?
 *
 * Written to be the gate between the steps of a credential rotation. After
 * every change — a new key, a new database password, a redeploy — something
 * has to answer "did that break the site?" with more than a glance at the
 * home page.
 *
 * Deliberately needs no credentials of its own. It only fetches public URLs,
 * which means it can be run by anyone, at any point, without holding a secret
 * that could itself leak. That is also why it is trustworthy as a gate: it
 * sees exactly what a visitor sees.
 *
 *   npm run health
 *   npm run health -- --buyer https://seyon.example --seller https://sell.seyon.example
 *
 * Exit 0 = every check passed. Exit 1 = at least one failed, and the output
 * names which and what it means.
 */

type Check = {
  name: string;
  url: string;
  /** Status codes that mean "working". A redirect can be the correct answer. */
  expect: number[];
  /** What a failure here actually tells you — the reason this check exists. */
  meaning: string;
  /** Substring that must appear in the body, when a 200 alone is not proof. */
  mustContain?: string;
  minBytes?: number;
};

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const buyer = arg('--buyer', process.env.HEALTH_BUYER_URL || 'https://seyon-pied.vercel.app').replace(/\/$/, '');
const seller = arg('--seller', process.env.HEALTH_SELLER_URL || 'https://seyon-seller.vercel.app').replace(/\/$/, '');

const CHECKS: Check[] = [
  {
    name: 'buyer home',
    url: `${buyer}/`,
    expect: [200],
    minBytes: 10_000,
    meaning: 'The buyer site is down entirely.',
  },
  {
    name: 'marketplace (reads the database)',
    url: `${buyer}/marketplace`,
    expect: [200],
    minBytes: 5_000,
    meaning: 'The app cannot read the database. After a rotation this means DATABASE_URL is wrong.',
  },
  {
    name: 'blog index (reads the database)',
    url: `${buyer}/blog`,
    expect: [200],
    minBytes: 5_000,
    meaning: 'Same as above, on a second table. Two failures together confirm the database, not one query.',
  },
  {
    name: 'search suggestions (writes to the database)',
    url: `${buyer}/api/search-suggestions?q=saree`,
    expect: [200],
    meaning:
      'The rate limiter could not write its counter row. A read that works with a write that does not points at row-level security or a permissions change, not at connectivity.',
  },
  {
    name: 'sitemap',
    url: `${buyer}/sitemap.xml`,
    expect: [200],
    mustContain: '<urlset',
    meaning: 'Search engines would see nothing. Usually a build problem rather than a credential one.',
  },
  {
    name: 'seller host redirects anonymous visitors',
    url: `${seller}/`,
    expect: [200, 307, 308],
    meaning: 'The seller host is not routing. Check the domain assignment on the seller project.',
  },
  {
    name: 'seller landing page',
    url: `${seller}/sell`,
    expect: [200],
    minBytes: 5_000,
    meaning: 'The seller site is down. Sellers cannot sign up or reach their dashboard.',
  },
];

async function run(check: Check) {
  const started = Date.now();
  let status = 0;
  let bytes = 0;
  let body = '';
  let networkError: string | null = null;

  try {
    // No redirect following: a 307 is an answer, not a step on the way to one.
    const res = await fetch(check.url, { redirect: 'manual', cache: 'no-store' });
    status = res.status;
    if (res.status < 300 || res.status >= 400) {
      body = await res.text();
      bytes = Buffer.byteLength(body);
    }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }

  const ms = Date.now() - started;
  const problems: string[] = [];

  if (networkError) problems.push(`could not be reached (${networkError})`);
  else {
    if (!check.expect.includes(status)) problems.push(`returned ${status}, expected ${check.expect.join(' or ')}`);
    if (check.minBytes && bytes > 0 && bytes < check.minBytes)
      problems.push(`returned only ${bytes} bytes — the page rendered, but nearly empty`);
    if (check.mustContain && !body.includes(check.mustContain))
      problems.push(`body did not contain ${check.mustContain}`);
  }

  const ok = problems.length === 0;
  const label = ok ? 'ok  ' : 'FAIL';
  const size = bytes ? ` ${(bytes / 1024).toFixed(0)}kb` : '';
  console.log(`${label}  ${String(status || '---').padStart(3)}  ${String(ms).padStart(5)}ms${size.padStart(7)}  ${check.name}`);
  if (!ok) {
    for (const p of problems) console.log(`        ${p}`);
    console.log(`        ${check.meaning}`);
  }
  return ok;
}

async function main() {
  console.log(`buyer   ${buyer}`);
  console.log(`seller  ${seller}`);
  console.log('');

  const results: boolean[] = [];
  for (const c of CHECKS) results.push(await run(c));

  const failed = results.filter((r) => !r).length;
  console.log('');
  if (failed === 0) {
    console.log(`All ${results.length} checks passed. Production is serving.`);
    process.exit(0);
  }
  console.log(`${failed} of ${results.length} checks failed. Do not proceed to the next step — fix or roll back first.`);
  process.exit(1);
}

main().catch((e) => {
  console.error('The health check itself failed:', e);
  process.exit(1);
});
