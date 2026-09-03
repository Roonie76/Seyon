/**
 * What a suspended seller is told when they try to change something.
 *
 * Lives here, and not beside the actions that use it, for a reason worth
 * writing down: `src/backend/actions/*.ts` are `'use server'` modules, and such
 * a module may only export async functions. Adding `export const` to one makes
 * the entire module fail to load at runtime — every action in it, not just the
 * new export — while passing `tsc` and every unit test. The failure surfaces
 * only when a real browser calls one of those actions, as "A 'use server' file
 * can only export async functions, found string."
 *
 * The message names the notice deliberately: that notice carries the reason and
 * is the only route to an appeal, and a refusal that does not say what to do
 * next is just a wall.
 */
export const SUSPENDED_MESSAGE =
  'Your store is suspended, so it cannot be changed right now. ' +
  'Open Notices to read why and to reply — that is how an appeal reaches us.';
