/**
 * Remove a production build before `next dev` runs on top of it.
 *
 * `next build` and `next dev` share the `.next` directory, and dev started
 * over a production build serves **404 for every /api/auth/* route** — no
 * error, no warning, nothing in the log except the 404 itself. Sign-in simply
 * stops working locally and looks like a code problem. It cost an hour once;
 * it should not cost anyone a second one.
 *
 * Only a production build is removed, identified by BUILD_ID, which `next dev`
 * never writes. An ordinary dev cache is left alone so the usual start stays
 * fast.
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), '.next');

if (existsSync(join(dir, 'BUILD_ID'))) {
  console.log('Removing the production build in .next so the dev server can start cleanly.');
  console.log('(dev over a production build serves 404 for /api/auth/* — silently.)');
  rmSync(dir, { recursive: true, force: true });
}
