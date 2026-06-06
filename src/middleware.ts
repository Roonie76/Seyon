import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';
  
  // A host is a seller host if it starts with 'sell', contains 'sell.', contains 'seller', or contains '-sell'
  const isSellerHost = host.startsWith('sell') || host.includes('sell.') || host.includes('seller') || host.includes('-sell');
  const path = url.pathname;

  if (isSellerHost) {
    // Seller Platform Domain:
    // If accessing any shopper-facing routes, redirect to the buyer marketplace
    if (
      path.startsWith('/marketplace') ||
      path.startsWith('/store') ||
      path.startsWith('/category') ||
      path.startsWith('/wishlist') ||
      path === '/privacy' ||
      path === '/terms'
    ) {
      const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
      const redirectUrl = new URL(path + request.nextUrl.search, buyerMarketUrl);
      return NextResponse.redirect(redirectUrl);
    }
    // If accessing the root path on the seller domain, redirect to the seller homepage `/sell`
    if (path === '/') {
      url.pathname = '/sell';
      return NextResponse.redirect(url);
    }
  } else {
    // Shopper Platform Domain:
    // If accessing any seller-specific routes, block access by rewriting to /404 to return a 404 Not Found error page
    if (path.startsWith('/sell') || path.startsWith('/dashboard')) {
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.webp$|.*\\.svg$|.*\\.gif$).*)',
  ],
};
