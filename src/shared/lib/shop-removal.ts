import { Role } from '@prisma/client';

/**
 * What an owner's role becomes once their store is gone.
 *
 * The seller self-delete hands the role back to `USER`, so that the sell
 * landing page reappears instead of a dashboard for a store that no longer
 * exists. Applying that unconditionally in the admin path would demote an
 * administrator who happened to own a storefront — removing a shop would
 * silently remove admin access, and the audit row would say `DELETE_SHOP` with
 * nothing about the privilege that went with it.
 *
 * So: only `SELLER` steps down. `null` means leave the role alone.
 *
 * A function rather than an inline condition because this is the part worth
 * testing, and testing it through the action would need an authenticated admin
 * session to prove one boolean.
 */
export function roleAfterShopRemoval(current: Role): Role | null {
  return current === Role.SELLER ? Role.USER : null;
}
