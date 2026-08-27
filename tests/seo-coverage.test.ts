import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { generateFAQJSONLD, safeJsonLdStringify } from '../src/shared/lib/seo';
import { helpArticles } from '../src/shared/data/help';

/**
 * The things that decide whether Seyon can be found or quoted.
 *
 * Most of these were absent rather than wrong, which is the failure mode that
 * never announces itself: /marketplace inherited the root layout's title, so
 * the two most commercially important pages on the site shipped identical
 * titles and descriptions, and nothing complained.
 */

const APP = join(__dirname, '..', 'src', 'app');

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

/** Public pages only: admin and the seller dashboard are deliberately unindexed. */
function isPublic(file: string): boolean {
  const rel = file.slice(file.indexOf(join('src', 'app')));
  return !['admin', 'dashboard', 'login', 'seller-account', 'shopper-account'].some((p) =>
    rel.includes(`${p}`)
  );
}

describe('page metadata', () => {
  const all = pages(APP).filter(isPublic);

  it('finds the public pages', () => {
    expect(all.length).toBeGreaterThan(15);
  });

  it('every public page declares its own title', () => {
    const bare = all.filter((f) => {
      const s = readFileSync(f, 'utf8');
      return !s.includes('export const metadata') && !s.includes('generateMetadata');
    });
    expect(
      bare.map((f) => f.slice(f.indexOf('src'))),
      `these inherit the root title, so they collide with each other:\n${bare.join('\n')}`
    ).toEqual([]);
  });
});

describe('crawler policy', () => {
  const robots = readFileSync(join(APP, 'robots.ts'), 'utf8');

  it('lets the assistants that answer live questions through', () => {
    // Blocking these makes Seyon uncitable the same day.
    for (const bot of ['OAI-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended']) {
      expect(robots).toContain(bot);
    }
  });

  it('keeps authenticated surfaces and endpoints out of the index', () => {
    for (const path of ['/dashboard/', '/admin/', '/api/']) {
      expect(robots).toContain(path);
    }
  });

  it('points at the sitemap', () => {
    expect(robots).toContain('sitemap.xml');
  });
});

describe('llms.txt', () => {
  const route = join(APP, 'llms.txt', 'route.ts');

  it('exists', () => {
    expect(existsSync(route)).toBe(true);
  });

  it('states the two things most often got wrong about Seyon', () => {
    const src = readFileSync(route, 'utf8');
    // No commission and no payment processing are the claims a summary
    // reliably gets backwards.
    expect(src).toMatch(/no commission/i);
    expect(src).toMatch(/does not process payments|processes no payments/i);
  });
});

describe('help centre structured data', () => {
  it('covers every article, not just the popular ones', () => {
    const entries = helpArticles.map((a) => ({ question: a.title, answer: a.content }));
    const schema = generateFAQJSONLD(entries) as { mainEntity: unknown[] };
    expect(schema.mainEntity).toHaveLength(helpArticles.length);
    expect(helpArticles.length).toBeGreaterThan(25);
  });

  it('is rendered through the escaping serialiser', () => {
    const page = readFileSync(join(APP, '(shopper)', 'help', 'page.tsx'), 'utf8');
    expect(page).toContain('safeJsonLdStringify');
    expect(page).toContain('generateFAQJSONLD');
  });

  it('cannot break out of the script tag', () => {
    const hostile = [{ question: 'q</script><script>alert(1)</script>', answer: 'a' }];
    const out = safeJsonLdStringify(generateFAQJSONLD(hostile));
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script>');
  });
});
