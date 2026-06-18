import { auth, signOut } from '@/lib/auth';
import { getWishlistCount } from '@/actions/wishlist';
import { SellerNavbarClient } from './seller-navbar-client';

export async function SellerNavbar() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  const session = await auth();
  const user = session?.user;
  const wishlistCount = user ? await getWishlistCount() : 0;

  const handleSignOut = async () => {
    'use server';
    await signOut({ redirectTo: '/sell' });
  };

  return (
    <SellerNavbarClient
      user={
        user
          ? {
              name: user.name,
              email: user.email,
              image: user.image,
              role: user.role,
            }
          : undefined
      }
      wishlistCount={wishlistCount}
      buyerMarketUrl={buyerMarketUrl}
      onSignOut={handleSignOut}
    />
  );
}

export default SellerNavbar;
