import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Placeholders that must never reach a user.
 *
 * Each of these was live in the application at the time this was written, found
 * by sweeping rather than by anyone reporting it — which is the point. A dummy
 * phone number in a footer is not a crash; it is a support channel that quietly
 * goes to a stranger, and nobody files a bug for it because from the outside it
 * looks like it works.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC);

/** Reads a file, minus comment lines, so explanatory prose is not a match. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

function offenders(pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(code(f))).map((f) => f.replace(SRC, 'src'));
}

describe('placeholders', () => {
  it('ships no dummy Indian phone number', () => {
    // 9876543210 is the standard placeholder. It was in the footer's WhatsApp
    // link, so every "message us" click opened a chat with nobody.
    // Input placeholder attributes are fine — those are meant to be examples.
    const bad = files.filter((f) => {
      const c = code(f);
      return /9876543210/.test(c) && !/placeholder=/.test(c);
    });
    expect(bad).toEqual([]);
  });

  it('publishes exactly one support address', () => {
    // Four were live at once. The one in the legal pages is the one a regulator
    // or an unhappy buyer uses, so it has to be the one that receives mail.
    expect(offenders(/support@seyon\.com/)).toEqual([]);
    expect(offenders(/seyonstoresupport@gmail\.com/)).toEqual([]);
  });

  it('never builds a URL from an empty site origin', () => {
    // `${process.env.NEXT_PUBLIC_SITE_URL || ''}/notices` sends "/notices" in an
    // email — an unclickable path. SITE_URL always resolves to an absolute one.
    expect(offenders(/NEXT_PUBLIC_SITE_URL\s*(\|\||\?\?)\s*''/)).toEqual([]);
  });

  it('does not name a domain the deployment does not own', () => {
    // seyon.in appears in contact addresses, which is intentional and
    // overridable. A hardcoded https://seyon.in asset URL is not.
    expect(offenders(/https:\/\/seyon\.in\//)).toEqual([]);
  });
});
