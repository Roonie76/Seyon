import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';

/**
 * Is the caller an admin *right now*?
 *
 * `session.user.role` is a JWT claim baked in at sign-in and refreshed only on
 * an explicit session update, so a revoked admin kept their powers until the
 * token expired. Privileged paths re-read the role from the database instead.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?.id) return false;

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return current?.role === Role.ADMIN;
}
