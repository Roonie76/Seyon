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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.USER;
      }
      if (trigger === 'update' && session?.role) {
        token.role = session.role;
      }
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
