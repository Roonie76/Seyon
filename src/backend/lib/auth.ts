import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { rateLimit, RATE_LIMITS } from './rate-limit';
import { isDevLoginEnabled } from './dev-login';
import { logger } from './logger';

if (isDevLoginEnabled()) {
  logger.warn(
    'SECURITY WARNING: Insecure dev login credentials provider is active! This should only be used in local development.'
  );
}

// Single source of truth for the secret. NextAuth v5 also auto-reads AUTH_SECRET
// internally for some operations, so AUTH_SECRET and NEXTAUTH_SECRET MUST hold the
// SAME value in every environment. A mismatch causes `error=Configuration` after a
// successful Google consent (state/JWT signed with one secret, verified with another).
//
// Resolved through `appSecret()` so this file, the PAN salt and the verification
// code HMAC cannot disagree about which variable holds it. Read lazily: a module
// -level call would throw at import time and take the build down with it.
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: authSecret,
  trustHost: true,
  // Debug only outside production. It was leaking internals and spamming logs.
  debug: process.env.NODE_ENV !== 'production',
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: process.env.ALLOW_DANGEROUS_ACCOUNT_LINKING === 'true',
    }),
    // Dev/demo only: passwordless email login. Excluded from production builds
    // (see src/backend/lib/dev-login.ts).
    ...(isDevLoginEnabled()
      ? [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Defense in depth: refuse even if the provider was somehow registered.
        if (!isDevLoginEnabled()) return null;
        if (!credentials?.email) return null;

        const email = credentials.email as string;

        const rl = await rateLimit(`login:${email.toLowerCase()}`, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs);
        if (!rl.success) {
          return null;
        }

        let user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await db.user.create({
            data: {
              email,
              name: email.split('@')[0],
              role: Role.USER,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.USER;
      }
      /**
       * There is deliberately no `trigger === 'update'` branch here.
       *
       * This callback used to carry `if (trigger === 'update' && session?.role)
       * token.role = session.role`. In Auth.js v5 that `session` argument is the
       * raw body posted to /api/auth/session — unvalidated client input — so any
       * signed-in buyer could POST {"role":"ADMIN"} and have the claim written
       * onto their own token. Four server actions gated on that claim, one of
       * which takes a shopId from the client, so it was a full takeover of any
       * storefront: rename it, and replace its WhatsApp number.
       *
       * Nothing in this codebase ever calls `useSession().update()`, so the
       * branch protected no feature. If a session refresh is ever needed, it
       * must re-read the role from the database — `isCurrentUserAdmin()` is the
       * pattern — and never take it from the caller.
       */
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
});
export type { Session } from 'next-auth';
export type { User } from 'next-auth';
