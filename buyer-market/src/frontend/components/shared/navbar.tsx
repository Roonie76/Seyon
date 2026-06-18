import { auth } from '@/lib/auth';
import { getWishlistCount } from '@/actions/wishlist';
import { NavbarClient } from './navbar-client';

export async function Navbar() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  const session = await auth();
  const user = session?.user;
  const wishlistCount = user ? await getWishlistCount() : 0;

  return (
    <NavbarClient
      user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
      wishlistCount={wishlistCount}
      buyerMarketUrl={buyerMarketUrl}
    />
  );
}

export default Navbar;
