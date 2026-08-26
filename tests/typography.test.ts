import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * One face, one declaration site.
 *
 * The site is set entirely in Fraunces. That only holds if nothing quietly
 * loads a second family: /about used to import Plus Jakarta Sans and Cormorant
 * Garamond and override the CSS variables locally, so it was the one page a
 * site-wide font change would have missed. A `.gold-pill-badge` rule forced
 * system-ui with !important for the same reason.
 *
 * The site was briefly set in IM Fell Double Pica, which has a single weight,
 * and carried `font-synthesis-weight: none` to stop browsers smearing a fake
 * bold. Fraunces has a real 300-800 range, so that rule must stay gone --
 * reintroducing it would render all ~1,000 bold utilities at 400 and flatten
 * the whole hierarchy. It is asserted absent rather than merely unmentioned.
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

  it('that family is Fraunces, loaded as a variable font', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toContain('Fraunces');
    // Pinning a single weight would drop the variable range and, with it, the
    // optical-size axis that motivated the choice.
    expect(layout).not.toMatch(/weight:\s*\[/);
  });

  it('points sans, serif and mono at the same face', () => {
    const css = readFileSync(CSS, 'utf8');
    for (const role of ['--font-sans', '--font-serif', '--font-mono']) {
      expect(css).toMatch(new RegExp(`${role}:\\s*var\\(--font-fraunces\\)`));
    }
  });

  it('does not disable weight synthesis', () => {
    // Only correct for a single-weight face. Fraunces has real bold; this rule
    // would render every font-bold, font-semibold and font-black at 400.
    expect(readFileSync(CSS, 'utf8')).not.toContain('font-synthesis-weight: none');
  });

  it('leaves optical sizing on', () => {
    expect(readFileSync(CSS, 'utf8')).toContain('font-optical-sizing: auto');
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

/**
 * The optical-size axis has to be in the file, not just in the CSS.
 *
 * next/font subsets a variable font to the weight axis unless the others are
 * named in `axes`. Without `opsz` the shipped woff2 carries `wght` alone,
 * `font-optical-sizing: auto` has nothing to act on, and the family loses the
 * property it was chosen for -- silently, with the CSS still looking correct.
 *
 * Found exactly that way: the built font was read back and had one axis.
 */
describe('the variable axes', () => {
  it('asks next/font for the optical-size axis by name', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toMatch(/axes:\s*\[[^\]]*"opsz"/);
  });
});
