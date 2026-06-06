import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Shopper-facing routes to redirect to the buyer marketplace
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

  // Root path on seller site redirects to the seller homepage `/sell`
  if (path === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/sell';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.webp$|.*\\.svg$|.*\\.gif$).*)',
  ],
};
