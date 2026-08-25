import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The example file has to keep up with the code.
 *
 * There were thirty-seven environment variables and no `.env.example` at all,
 * so the only way to find out what a deployment needed was to read the source
 * or watch it fail. A stale example is the same problem wearing a disguise, so
 * this fails the build when the two drift.
 */

const SRC = join(process.cwd(), 'src');

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}

/** Set by the runtime, not by whoever deploys — nothing to document. */
const FRAMEWORK_SET = new Set(['NODE_ENV']);

const referenced = new Set<string>();
for (const f of files(SRC)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z_0-9]+)/g)) {
    // `process.env.NEXT_PUBLIC_` with nothing after it is a prefix check.
    if (m[1] !== 'NEXT_PUBLIC_') referenced.add(m[1]);
  }
}

const documented = new Set(
  [...readFileSync(join(process.cwd(), '.env.example'), 'utf8').matchAll(/^([A-Z_0-9]+)=/gm)].map(
    (m) => m[1]
  )
);

describe('.env.example', () => {
  it('documents every variable the code reads', () => {
    const missing = [...referenced].filter((k) => !documented.has(k) && !FRAMEWORK_SET.has(k));
    expect(missing.sort()).toEqual([]);
  });

  it('documents the migration connection Prisma needs', () => {
    // Read by prisma/schema.prisma rather than by src/, so the sweep above
    // cannot see it — and forgetting it breaks every migration.
    expect(documented.has('DIRECT_URL')).toBe(true);
  });

  it('says what happens when the scheduled job secret is missing', () => {
    // The failure mode is silence: the route answers 503 and nothing runs.
    const text = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    expect(text).toMatch(/CRON_SECRET/);
    expect(text).toMatch(/503/);
  });
});
