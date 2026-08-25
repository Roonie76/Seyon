import { db } from '@/lib/db';
import { Role } from '@prisma/client';

/**
 * The account scheduled work acts as.
 *
 * `AdminAction.actorId` is a non-null foreign key with `onDelete: Restrict`,
 * deliberately: evidence of what an admin did must not be erasable by deleting
 * the admin. A nightly sweep has no human actor, and there were two ways to
 * handle that — make `actorId` nullable with a CHECK that a null actor carries
 * a job name, or give the jobs an account.
 *
 * An account wins. The audit table is untouched, `auditTrailFor` and the global
 * log render system actions with no special case, and "who did this" always has
 * an answer rather than sometimes having a different shape.
 *
 * It is a `USER`, not an `ADMIN`. Nothing signs in as it — the address is on a
 * domain nobody can receive mail at, and production has no password login — but
 * if anything ever did, `requireAdmin` would refuse it. A job account that
 * could act as an admin would be a standing back door with a friendly name.
 */

export const SYSTEM_ACTOR_EMAIL = 'system@seyon.internal';
const SYSTEM_ACTOR_NAME = 'Seyon (scheduled job)';

let cachedId: string | null = null;

/**
 * The system account's id, created on first use.
 *
 * Upserted rather than seeded by migration so that a fresh database — a local
 * clone, a test run, a rebuilt production — never fails a job for want of a
 * row. Cached per process because it is read on every scheduled run and never
 * changes.
 */
export async function systemActorId(): Promise<string> {
  if (cachedId) return cachedId;

  const user = await db.user.upsert({
    where: { email: SYSTEM_ACTOR_EMAIL },
    update: {},
    create: {
      email: SYSTEM_ACTOR_EMAIL,
      name: SYSTEM_ACTOR_NAME,
      role: Role.USER,
    },
    select: { id: true },
  });

  cachedId = user.id;
  return user.id;
}

/** Test seam: forget the cached id between runs. */
export function _resetSystemActorCache(): void {
  cachedId = null;
}
