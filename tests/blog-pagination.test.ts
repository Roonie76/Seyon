/**
 * Guards on the blog index, all of which are regressions that shipped.
 *
 * The `?page=` handling crashed the route, the pagination controls were not
 * crawlable, and the page's own title advertised content that had been
 * unpublished. None of those were caught by a type check or a build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const INDEX_RAW = readFileSync(join(ROOT, 'src/app/(shopper)/blog/page.tsx'), 'utf8');
const PAGINATION_RAW = readFileSync(
  join(ROOT, 'src/frontend/components/blog/Pagination/Pagination.tsx'),
  'utf8'
);
/** Comments describe the bug being prevented and would match the guard. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PAGINATION = stripComments(PAGINATION_RAW);

/** The clamp the route applies, restated so the behaviour itself is tested. */
function clampPage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

const INDEX = stripComments(INDEX_RAW);

describe('blog page parameter', () => {
  it('never yields a page below 1, whatever the query string says', () => {
    for (const bad of ['abc', '0', '-1', '-999', '', undefined, 'NaN', 'Infinity', '1e400']) {
      const page = clampPage(bad);
      expect(page, `?page=${bad}`).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(page), `?page=${bad}`).toBe(true);
    }
  });

  it('never yields a negative or fractional skip', () => {
    const perPage = 6;
    for (const bad of ['abc', '0', '-1', '1.5', '2.9', undefined]) {
      const skip = (clampPage(bad) - 1) * perPage;
      expect(skip, `?page=${bad}`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(skip), `?page=${bad}`).toBe(true);
    }
  });

  it('keeps valid pages intact', () => {
    expect(clampPage('1')).toBe(1);
    expect(clampPage('4')).toBe(4);
  });

  it('clamps in the route rather than passing the raw number to Prisma', () => {
    // The crash was `Number(page || '1')` going straight into `skip`.
    expect(INDEX).not.toContain("Number(page || '1')");
    expect(INDEX).toMatch(/Number\.isFinite\(requested\)/);
  });
});

describe('pagination controls', () => {
  it('navigates with anchors, so a crawler can follow them', () => {
    expect(PAGINATION).toContain('next/link');
    expect(PAGINATION).toMatch(/<Link\b/);
  });

  it('does not navigate by pushing from a click handler', () => {
    // `<button onClick={() => router.push(...)}>` is invisible to a crawler.
    expect(PAGINATION).not.toMatch(/router\.push/);
    expect(PAGINATION).not.toMatch(/useRouter/);
  });

  it('marks the current page for assistive technology', () => {
    expect(PAGINATION).toContain("aria-current");
  });
});

describe('sidebar search', () => {
  const SEARCH = stripComments(
    readFileSync(join(ROOT, 'src/frontend/components/blog/Sidebar/Search.tsx'), 'utf8')
  );

  it('compares against the query already in the URL before pushing', () => {
    // Without this guard the debounce fires on mount, and since it deletes
    // `page` it silently undoes every pagination click.
    expect(SEARCH).toMatch(/const activeQuery = searchParams\.get\('q'\)/);
    expect(SEARCH).toMatch(/if \(next === activeQuery\) return;/);
  });

  it('still drops the page number when the query actually changes', () => {
    expect(SEARCH).toContain("params.delete('page')");
  });
});

describe('blog index metadata', () => {
  it('does not describe the retired seller guides', () => {
    const forbidden = [
      'Guides for Independent Sellers',
      'independent sellers in India',
      'selling on Instagram and WhatsApp',
      'Luxury Stories',
    ];
    for (const phrase of forbidden) {
      expect(INDEX, `blog index still mentions "${phrase}"`).not.toContain(phrase);
    }
  });

  it('canonicalises a paginated view to itself, not to page one', () => {
    expect(INDEX).toMatch(/canonical: paged \? `\/blog\?page=\$\{pageNumber\}` : '\/blog'/);
  });
});
