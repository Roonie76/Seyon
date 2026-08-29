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
import { parsePage, MAX_PAGE } from '@/shared/lib/search-params';

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

/**
 * The route now uses the shared parser rather than its own arithmetic. The
 * local copy existed because the two had drifted: the route floored at 1 but
 * had no ceiling, so `?page=99999999999999999999` produced a `skip` Prisma
 * could not fit into an i64 and the public page returned 500.
 */
const clampPage = parsePage;

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

  it('has an upper bound, so `skip` always fits in an i64', () => {
    // Reproduced: /blog?page=99999999999999999999 returned 500 while
    // /blog?page=100000 returned 200. The floor was there; the ceiling wasn't.
    const perPage = 9;
    for (const huge of [
      '1001',
      '100000',
      '99999999999999999999',
      '1e20',
      String(Number.MAX_SAFE_INTEGER),
    ]) {
      const page = clampPage(huge);
      expect(page, `?page=${huge}`).toBeLessThanOrEqual(MAX_PAGE);
      const skip = (page - 1) * perPage;
      expect(Number.isSafeInteger(skip), `?page=${huge}`).toBe(true);
      expect(skip, `?page=${huge}`).toBeLessThan(2 ** 63 - 1);
    }
  });

  it('clamps in the route rather than passing the raw number to Prisma', () => {
    // The crash was `Number(page || '1')` going straight into `skip`.
    expect(INDEX).not.toContain("Number(page || '1')");
    // And the route must use the shared parser, not a hand-rolled clamp that
    // can drift away from it again.
    expect(INDEX).not.toMatch(/Number\.isFinite\(requested\)/);
    expect(INDEX).toMatch(/const currentPage = parsePage\(page\);/);
    expect(INDEX).toMatch(/const pageNumber = parsePage\(page\);/);
  });

  it('never offers a page link past the parser ceiling', () => {
    expect(INDEX).toMatch(/Math\.min\(Math\.ceil\(totalCount \/ postsPerPage\), MAX_PAGE\)/);
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
