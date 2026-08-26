import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * One face, one declaration site.
 *
 * The site is set entirely in IM Fell Double Pica. That only holds if nothing
 * quietly loads a second family: /about used to import Plus Jakarta Sans and
 * Cormorant Garamond and override the CSS variables locally, so it was the one
 * page a site-wide font change would have missed. A `.gold-pill-badge` rule
 * forced system-ui with !important for the same reason.
 *
 * IM Fell also ships a single weight. `font-synthesis-weight: none` is what
 * stops a browser smearing a fake bold across the ~1,000 places this codebase
 * asks for one, so its removal would be a visual regression nothing else
 * catches.
 */

const SRC = join(__dirname, '..', 'src');
const CSS = join(SRC, 'app', 'globals.css');
const LAYOUT = join(SRC, 'app', 'layout.tsx');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

describe('typography', () => {
  it('loads exactly one font family, in the root layout', () => {
    const importers = walk(SRC, ['.tsx', '.ts']).filter((f) =>
      readFileSync(f, 'utf8').includes('next/font/google')
    );
    expect(importers.map((f) => f.slice(f.indexOf('src')))).toEqual([
      join('src', 'app', 'layout.tsx'),
    ]);
  });

  it('that family is IM Fell Double Pica', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toContain('IM_Fell_Double_Pica');
    // One weight is all it has; asking for others would silently fail.
    expect(layout).toMatch(/weight:\s*\["400"\]/);
  });

  it('points sans, serif and mono at the same face', () => {
    const css = readFileSync(CSS, 'utf8');
    for (const role of ['--font-sans', '--font-serif', '--font-mono']) {
      expect(css).toMatch(new RegExp(`${role}:\\s*var\\(--font-im-fell\\)`));
    }
  });

  it('turns off synthesised bold', () => {
    expect(readFileSync(CSS, 'utf8')).toContain('font-synthesis-weight: none');
  });

  it('has no rule forcing another family', () => {
    const css = readFileSync(CSS, 'utf8');
    const forced = css
      .split('\n')
      .filter((l) => /font-family/.test(l) && !/--font-/.test(l) && !/^\s*\*/.test(l));
    expect(forced, `these bypass the shared face:\n${forced.join('\n')}`).toEqual([]);
  });

  it('keeps no text below 11px, which this face cannot carry', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, ['.tsx', '.jsx'])) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/text-\[(\d+)px\]/g)) {
        if (Number(m[1]) < 11) {
          offenders.push(`${file.slice(file.indexOf('src'))}: ${m[0]}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
