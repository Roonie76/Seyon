import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { rateLimit, RATE_LIMITS } from './rate-limit';

/**
 * Admin authorisation, checked against the database rather than the token.
 *
 * `session.user.role` is a JWT claim written at sign-in and only refreshed on an
 * explicit session update. Trusting it alone meant a demoted admin kept full
 * admin powers until their token expired — up to thirty days. The extra read is
 * one indexed lookup, on a handful of privileged routes.
 *
 * This lived as a private function inside `actions/admin.ts`. It moved here when
 * moderation, complaints, notices and access control each needed the same check:
 * four copies of an authorisation routine is four places for one of them to
 * quietly lose the database read.
 */
export async function requireAdmin(): Promise<{ actorId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Forbidden: Admin authorization required');
  }

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (current?.role !== Role.ADMIN) {
    throw new Error('Forbidden: Admin authorization required');
  }

  // A stolen admin session should not be able to suspend every store in the
  // marketplace as fast as the network allows. Generous enough that no real
  // reviewer will ever see it.
  const rl = await rateLimit(
    `admin-action:${session.user.id}`,
    RATE_LIMITS.ADMIN_ACTION.limit,
    RATE_LIMITS.ADMIN_ACTION.windowMs
  );
  if (!rl.success) {
    throw new Error('Too many admin actions in a short time. Slow down and try again shortly.');
  }

  return { actorId: session.user.id };
}
