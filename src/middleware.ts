import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function htmlRedirect(url: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url=${url}" />
    <script>window.location.replace("${url}");</script>
    <title>Redirecting...</title>
  </head>
  <body>
    <p>Redirecting to <a href="${url}">${url}</a>...</p>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

import { isSellerHost } from '@/lib/is-seller-host';

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
      return htmlRedirect(redirectUrl.toString());
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
    // If accessing any seller-specific routes, redirect them to the seller domain
    if (path.startsWith('/sell') || path.startsWith('/dashboard') || path.startsWith('/seller-account')) {
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      const sellerHost = isLocal ? '127.0.0.1:3000' : 'seyon-seller.vercel.app';
      const protocol = isLocal ? 'http' : 'https';
      const redirectUrl = new URL(path + request.nextUrl.search, `${protocol}://${sellerHost}`);
      return htmlRedirect(redirectUrl.toString());
    }
    // Rewrite clean /account route to the internal shopper page
    if (path === '/account') {
      url.pathname = '/shopper-account';
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
