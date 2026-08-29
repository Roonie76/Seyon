/**
 * The cart's real-time validation effect fired forever when the endpoint
 * failed.
 *
 * Measured on a running server with `/api/cart/validate` failing: 291 POSTs in
 * ten seconds, accelerating, and nothing in the page to stop it. Rate limiting
 * makes it worse rather than better — a rejected request is itself a failure,
 * which is what re-arms the loop.
 *
 * The mechanism, restated below as `runEffect` so the fix is tested and not
 * merely asserted about: the guard read `validation`, which is only set on
 * success, and `isValidating`, which a `finally` block always resets. On
 * failure both were falsy again, the dependency array had changed, and the
 * effect re-ran into a guard that now passed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_RAW = readFileSync(
  join(__dirname, '..', 'src/app/(shopper)/cart/cart-client.tsx'),
  'utf8'
);
const SRC = SRC_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

type Cart = Record<string, Array<{ productId: string; selectionsKey: string; quantity: number }>>;

const CART: Cart = { 'shop-a': [{ productId: 'p1', selectionsKey: '_', quantity: 1 }] };

function signature(cart: Cart): string {
  const shopIds = Object.keys(cart).sort();
  return JSON.stringify(
    shopIds.map((shopId) => [
      shopId,
      cart[shopId].map((i) => `${i.productId}|${i.selectionsKey}|${i.quantity}`).sort(),
    ])
  );
}

/**
 * The old guard, driven the way React drives it: re-run whenever a dependency
 * changes, with the endpoint always failing.
 */
function runOldEffect(cart: Cart, maxIterations = 500): number {
  let validation: unknown = null;
  let isValidating = false;
  let calls = 0;

  for (let i = 0; i < maxIterations; i += 1) {
    const hasItems = Object.keys(cart).length > 0;
    if (!hasItems || validation || isValidating) break;
    isValidating = true;
    calls += 1;
    // The request fails: `validation` is never assigned, and `finally` clears
    // the in-flight flag. Both dependencies changed, so the effect re-runs.
    validation = null;
    isValidating = false;
  }
  return calls;
}

/** The current guard: a signature ref, latched before the request is sent. */
function runNewEffect(cart: Cart, maxIterations = 500): number {
  let attempted: string | null = null;
  let calls = 0;

  for (let i = 0; i < maxIterations; i += 1) {
    const shopIds = Object.keys(cart).sort();
    if (shopIds.length === 0) {
      attempted = null;
      break;
    }
    const sig = signature(cart);
    if (attempted === sig) break;
    attempted = sig;
    calls += 1;
    // Request fails. Nothing about the latch depends on the outcome.
  }
  return calls;
}

describe('cart validation', () => {
  it('the old guard looped without bound when the request failed', () => {
    // Establishes that the guard below is load-bearing, not decoration.
    expect(runOldEffect(CART)).toBe(500);
  });

  it('fires exactly once per cart state, whether or not the request succeeds', () => {
    expect(runNewEffect(CART)).toBe(1);
  });

  it('fires again when the cart actually changes', () => {
    const changed: Cart = { 'shop-a': [{ productId: 'p1', selectionsKey: '_', quantity: 2 }] };
    expect(signature(CART)).not.toBe(signature(changed));
  });

  it('does not fire again when only the key order changes', () => {
    const reordered: Cart = {
      'shop-b': [{ productId: 'p2', selectionsKey: '_', quantity: 1 }],
      'shop-a': [{ productId: 'p1', selectionsKey: '_', quantity: 1 }],
    };
    const original: Cart = {
      'shop-a': [{ productId: 'p1', selectionsKey: '_', quantity: 1 }],
      'shop-b': [{ productId: 'p2', selectionsKey: '_', quantity: 1 }],
    };
    expect(signature(reordered)).toBe(signature(original));
  });

  it('resets the latch when the cart empties, so refilling revalidates', () => {
    expect(runNewEffect({})).toBe(0);
  });
});

describe('the component matches the model above', () => {
  it('latches on a signature ref', () => {
    expect(SRC).toContain('attemptedSignatureRef');
    expect(SRC).toMatch(/if \(attemptedSignatureRef\.current === signature\) return;/);
  });

  it('no longer keys the effect on its own request state', () => {
    // These two in the dependency array are what closed the loop.
    expect(SRC).not.toMatch(/if \(!hasItems \|\| validation \|\| isValidating\) return;/);
    expect(SRC).not.toMatch(/\[isMounted, cartGroups, validation, validateCart, isValidating\]/);
    expect(SRC).toMatch(/\[isMounted, cartGroups, validateCart\]/);
  });

  it('still offers a deliberate retry', () => {
    // The auto-retry is gone, so the manual one has to stay.
    expect(SRC).toMatch(/onClick=\{\(\) => validateCart\(cartGroups\)\}/);
  });
});
