import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The root layout sets `template: "%s | Seyon"`, so Next appends the brand to
 * every page title by itself. A page whose own title already ends in a brand
 * segment therefore ships it twice -- "Privacy Policy | Seyon | Seyon", or
 * "Complaints | Seyon Admin | Seyon" -- which is what a visitor sees in their
 * browser tab and what a search result shows.
 *
 * Caught by sweeping the live site rather than by reading the code, because
 * both halves are correct on their own; the duplication only exists once
 * Next composes them.
 *
 * The first version of this test matched only titles ending in exactly
 * "| Seyon", so it passed while eleven admin and seller pages still shipped
 * "| Seyon Admin | Seyon". The rule is not "ends with the brand" but "the last
 * segment is a brand segment", which is what the pattern below says.
 *
 * A title that merely mentions Seyon in prose -- "Seyon Blog — Luxury Stories"
 * -- is left alone. It has no trailing brand segment, so the template adds the
 * only one there is.
 */

/** A final "| Seyon…" segment: the thing the template is about to add again. */
const TRAILING_BRAND = /\|\s*Seyon\b[^|]*$/;

const APP = join(__dirname, '..', 'src', 'app');

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === 'page.tsx' || entry === 'layout.tsx') out.push(full);
  }
  return out;
}

/**
 * Strip the `openGraph` and `twitter` blocks.
 *
 * Next applies the title template to `metadata.title` only. A title set
 * explicitly inside openGraph or twitter is passed through untouched, so one
 * ending in "| Seyon" there is correct, not a duplicate. Balanced-brace scan
 * rather than a regex, because a regex cannot count.
 */
function stripSocialBlocks(source: string): string {
  let out = source;
  for (const key of ['openGraph', 'twitter']) {
    for (;;) {
      const at = out.indexOf(`${key}:`);
      if (at === -1) break;
      const open = out.indexOf('{', at);
      if (open === -1) break;
      let depth = 0;
      let i = open;
      for (; i < out.length; i++) {
        if (out[i] === '{') depth++;
        else if (out[i] === '}' && --depth === 0) break;
      }
      out = out.slice(0, at) + out.slice(i + 1);
    }
  }
  return out;
}

/** The literal assigned to `title:` in a metadata object, if there is one. */
function titlesIn(source: string): string[] {
  const out: string[] = [];
  const re = /title:\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  const scanned = stripSocialBlocks(source);
  let m: RegExpExecArray | null;
  while ((m = re.exec(scanned)) !== null) out.push(m[2]);
  return out;
}

describe('page titles', () => {
  const files = pageFiles(APP);

  it('finds pages to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no page title ends in a brand segment the layout template already appends', () => {
    const offenders: string[] = [];

    for (const file of files) {
      // The root layout is where the template itself is declared; its own
      // `default` title is the one page that is supposed to carry the brand.
      if (file.endsWith(join('src', 'app', 'layout.tsx'))) continue;

      for (const title of titlesIn(readFileSync(file, 'utf8'))) {
        if (TRAILING_BRAND.test(title)) {
          offenders.push(`${file.slice(file.indexOf('src'))}: "${title}"`);
        }
      }
    }

    expect(offenders, `these would render as "… | Seyon | Seyon":\n${offenders.join('\n')}`)
      .toEqual([]);
  });
});
