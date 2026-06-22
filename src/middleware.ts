import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Seller hosts are configured explicitly via the SELLER_HOSTS env var
 * (comma-separated hostnames, no protocol, no port), e.g.:
 *   SELLER_HOSTS="sell.seyon.in,seyon-seller.vercel.app"
 *
 * Exact hostname matching replaces the old substring sniffing
 * (host.includes('sell')), which misclassified any shopper domain
 * containing "sell" anywhere in it.
 */
function getSellerHosts(): Set<string> {
  const configured = process.env.SELLER_HOSTS || 'seyon-seller.vercel.app,localhost:3001,127.0.0.1:3000';
  return new Set(
    configured
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isSellerHost(host: string): boolean {
  const sellerHosts = getSellerHosts();
  const normalized = host.toLowerCase();
  const withoutPort = normalized.replace(/:\d+$/, '');
  return sellerHosts.has(normalized) || sellerHosts.has(withoutPort);
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';
  const path = url.pathname;

  if (isSellerHost(host)) {
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
    // Rewrite clean /account route to the internal seller page
    if (path === '/account') {
      url.pathname = '/seller-account';
      return NextResponse.rewrite(url);
    }
    // Block direct access to internal shopper-account route
    if (path === '/shopper-account') {
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }
  } else {
    // Shopper Platform Domain:
    // If accessing any seller-specific routes, block access by rewriting to /404 to return a 404 Not Found error page
    if (path.startsWith('/sell') || path.startsWith('/dashboard')) {
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }
    // Rewrite clean /account route to the internal shopper page
    if (path === '/account') {
      url.pathname = '/shopper-account';
      return NextResponse.rewrite(url);
    }
    // Block direct access to internal seller-account route
    if (path === '/seller-account') {
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
