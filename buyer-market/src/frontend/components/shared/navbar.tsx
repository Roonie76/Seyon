import { auth, signOut } from '@/lib/auth';
import { getWishlistCount } from '@/actions/wishlist';
import { NavbarClient } from './navbar-client';
import { db } from '@/lib/db';

export async function Navbar() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  const session = await auth();
  const user = session?.user;
  const wishlistCount = user ? await getWishlistCount() : 0;

  const dbUser = user?.id
    ? await db.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true, image: true, role: true },
      })
    : null;

  const handleSignOut = async () => {
    'use server';
    await signOut({ redirectTo: '/marketplace' });
  };

  const displayUser = dbUser
    ? { name: dbUser.name, email: dbUser.email, image: dbUser.image, role: dbUser.role }
    : user
    ? { name: user.name, email: user.email, image: user.image, role: user.role }
    : undefined;

  return (
    <NavbarClient
      user={displayUser}
      wishlistCount={wishlistCount}
      buyerMarketUrl={buyerMarketUrl}
      onSignOut={handleSignOut}
    />
  );
}

export default Navbar;
