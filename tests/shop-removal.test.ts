import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { roleAfterShopRemoval } from '@/shared/lib/shop-removal';

/**
 * One boolean, but the one worth pinning down.
 *
 * Testing it through `deleteShopAsAdmin` would mean standing up an
 * authenticated admin session to assert a role transition, so the decision
 * lives in its own function and is tested directly.
 */
describe('roleAfterShopRemoval', () => {
  it('steps a seller down to buyer', () => {
    // Otherwise the seller dashboard keeps rendering for a store that is gone.
    expect(roleAfterShopRemoval(Role.SELLER)).toBe(Role.USER);
  });

  it('leaves an admin alone', () => {
    // The bug this exists to prevent: an admin who happens to own a storefront
    // losing admin access because someone removed the storefront. The audit row
    // would say DELETE_SHOP and say nothing about the privilege that went too.
    expect(roleAfterShopRemoval(Role.ADMIN)).toBeNull();
  });

  it('leaves a plain buyer alone', () => {
    expect(roleAfterShopRemoval(Role.USER)).toBeNull();
  });

  it('returns either null or a real role for every role in the schema', () => {
    for (const role of Object.values(Role)) {
      const next = roleAfterShopRemoval(role);
      expect(next === null || Object.values(Role).includes(next)).toBe(true);
    }
    // A fourth role added to the schema should make someone revisit this file
    // rather than fall through to "leave it alone" unnoticed.
    expect(Object.values(Role)).toHaveLength(3);
  });
});
