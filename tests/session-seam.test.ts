/**
 * The application asks one function who is signed in.
 *
 * This is a structural test, and it exists because the thing it protects is
 * invisible in every individual file. Fifty-six call sites each said
 * `await auth()`, which is correct and also means the auth provider's name is
 * written in thirty-nine places. Swapping providers then means editing all of
 * them and hoping none was missed — and a missed one does not fail to compile,
 * it quietly keeps the old provider alive for one route.
 *
 * So the rule is: `getSession()` everywhere, `auth()` only inside the seam and
 * the NextAuth route handler that has to mount it. If that stops being true,
 * this fails and names the file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/** The two files allowed to know NextAuth exists. */
const ALLOWED = [
  'src/backend/lib/session.ts',
  'src/backend/lib/auth.ts',
  'src/app/api/auth/[...nextauth]/route.ts',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((f) => ({
  path: relative(ROOT, f).split('\\').join('/'),
  text: readFileSync(f, 'utf8'),
}));

describe('who is signed in comes from one place', () => {
  it('has call sites, so the check is not passing on an empty set', () => {
    const callers = files.filter((f) => /await getSession\(\)/.test(f.text));
    expect(callers.length).toBeGreaterThan(20);
  });

  it('nobody outside the seam calls the provider directly', () => {
    const offenders = files
      .filter((f) => !ALLOWED.includes(f.path))
      .filter((f) => /await auth\(\)/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('nobody outside the seam imports the provider', () => {
    const offenders = files
      .filter((f) => !ALLOWED.includes(f.path))
      .filter((f) => /import \{[^}]*\bauth\b[^}]*\} from '@\/(backend\/)?lib\/auth'/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('changes nothing about what the provider returned', () => {
    /*
     * The seam is a pass-through and must stay one. An earlier version also
     * returned null when the session had no user id, which rerouted one call
     * site to a different error branch — a silent semantic change across
     * thirty-eight files, which is exactly what makes a provider swap
     * unreviewable. If a guard is wanted it belongs at the call sites, or in
     * its own commit.
     */
    const seam = readFileSync(join(SRC, 'backend/lib/session.ts'), 'utf8');
    const body = seam.slice(seam.indexOf('export async function getSession'));
    expect(body).not.toMatch(/return null;/);
  });
});
