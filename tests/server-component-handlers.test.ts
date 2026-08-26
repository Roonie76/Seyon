import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Event handlers cannot cross the server/client boundary.
 *
 * A Server Component that passes `onClick` to a Client Component throws at
 * render time — React cannot serialise a function. The catch is that it throws
 * only when that JSX is actually reached, so a handler inside
 * `posts.map(...)` is invisible while the list is empty and breaks the page
 * the moment the first row exists.
 *
 * That is exactly how /admin/blog failed: it rendered fine for months with no
 * posts, then threw the moment three were written. The empty-state branch had
 * been the only branch anyone had ever seen.
 *
 * A type checker does not catch this — the prop types are correct on both
 * sides. So it is checked here instead.
 */

const SRC = join(__dirname, '..', 'src');

const HANDLER =
  /\son(Click|Change|Submit|Input|Blur|Focus|KeyDown|KeyUp|MouseEnter|MouseLeave|Select)=\{/;

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...componentFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) out.push(full);
  }
  return out;
}

/** The directive has to be at the top of the file to count. */
function isClientComponent(source: string): boolean {
  const head = source.slice(0, 400);
  return head.includes("'use client'") || head.includes('"use client"');
}

describe('server components', () => {
  const files = componentFiles(SRC);

  it('finds components to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never pass an event handler to a client component', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (isClientComponent(source)) continue;

      const lines = source.split('\n');
      lines.forEach((line, i) => {
        if (HANDLER.test(line)) {
          offenders.push(`${file.slice(file.indexOf('src'))}:${i + 1} — ${line.trim().slice(0, 70)}`);
        }
      });
    }

    expect(
      offenders,
      `these throw when their branch is first rendered:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
