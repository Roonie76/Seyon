/**
 * The masthead carries a month, and a month typed into source rots.
 *
 * "August Edition" hardcoded reads as an abandoned site from the first of
 * September, on the page whose whole job is to look current to a stranger
 * arriving from a search months later.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const HERO = readFileSync(
  join(ROOT, 'src/frontend/components/blog/HeroBanner/HeroBanner.tsx'),
  'utf8'
);
const INDEX = readFileSync(join(ROOT, 'src/app/(shopper)/blog/page.tsx'), 'utf8');

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

describe('blog masthead', () => {
  it('never hardcodes a month name', () => {
    const hero = stripComments(HERO);
    for (const month of MONTHS) {
      expect(hero, `HeroBanner hardcodes "${month}"`).not.toContain(month);
    }
  });

  it('takes the edition from a prop rather than reading the clock itself', () => {
    // HeroBanner is a client component; a request straddling midnight on the
    // first would render one month on the server and another on the client.
    const hero = stripComments(HERO);
    expect(hero).toMatch(/edition/);
    expect(hero, 'the hero must not construct its own Date').not.toMatch(/new Date\(/);
  });

  it('derives the month on the server, in IST', () => {
    expect(INDEX).toMatch(/toLocaleString\('en-IN'/);
    expect(INDEX).toContain("timeZone: 'Asia/Kolkata'");
    expect(INDEX).toMatch(/month: 'long'/);
  });

  it('produces a real month name today', () => {
    const edition = new Date().toLocaleString('en-IN', {
      month: 'long',
      timeZone: 'Asia/Kolkata',
    });
    expect(MONTHS).toContain(edition);
  });

  it('keeps the page dynamic, so the month cannot be baked into a build', () => {
    expect(INDEX).toContain("export const dynamic = 'force-dynamic'");
  });
});
