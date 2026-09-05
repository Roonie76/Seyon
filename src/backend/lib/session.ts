import { auth } from './auth';
import type { Role } from '@prisma/client';

/**
 * The one place the application asks who is signed in.
 *
 * Every server action, page and route guard used to call `auth()` directly —
 * fifty-six call sites across thirty-nine files, each one coupled to NextAuth
 * by name. Replacing the auth provider meant editing all fifty-six and hoping
 * none was missed, which is the kind of change that is technically simple and
 * practically frightening.
 *
 * With one seam it is a change of two files instead: this one, and whatever
 * verifies the token. The call sites do not know or care which provider is
 * behind it, and a test asserts they stay that way.
 *
 * Deliberately identical in behaviour to the `auth()` it replaces. This
 * refactor moves no logic and fixes no bug; anything else changing at the same
 * time would make a provider swap impossible to review.
 */

/** What the application is allowed to know about the signed-in person. */
export interface AppSession {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role: Role;
  };
}

/**
 * The signed-in session, or null.
 *
 * A pass-through, and it has to stay one. The first version of this function
 * also returned null for a session whose user carried no id — defensible on
 * its own, and wrong here: it rerouted one call site from "no user id" to "not
 * logged in", which a test caught. A seam that quietly changes semantics in
 * thirty-eight files is worse than no seam, because the provider swap it
 * exists to enable can no longer be reviewed as a swap. Call sites keep their
 * own checks; hardening, if it is wanted, is a separate and deliberate change.
 *
 * `role` here is the claim written at sign-in. It is enough for showing the
 * right navigation and nothing else: anything that grants access re-reads the
 * role from the database (`requireAdmin`, `isCurrentUserAdmin`), because a
 * claim the client's own token carries is not an authority. That distinction
 * is what the removed `trigger === 'update'` branch violated, and it must
 * survive whatever provider sits behind this function.
 */
export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  return (session as unknown as AppSession | null) ?? null;
}
