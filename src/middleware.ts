import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';
  
  // A host is a seller host if it starts with 'sell' (e.g. sell.localhost:3000, sell-seyon-pied.vercel.app, sell.seyon.app)
  const isSellerHost = host.startsWith('sell') || host.includes('sell.');
  const path = url.pathname;

  if (isSellerHost) {
    // Seller Platform Domain:
    // If accessing any shopper-facing routes or the root path, redirect to the seller homepage `/sell`
    if (path === '/' || path.startsWith('/marketplace') || path.startsWith('/store') || path.startsWith('/category')) {
      url.pathname = '/sell';
      return NextResponse.redirect(url);
    }
  } else {
    // Shopper Platform Domain:
    // If accessing any seller-specific routes, block access by rewriting to /404 to return a 404 Not Found error page
    if (path.startsWith('/sell') || path.startsWith('/dashboard') || path.startsWith('/login')) {
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - png, jpg, jpeg, webp, svg, gif (static image assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.webp$|.*\\.svg$|.*\\.gif$).*)',
  ],
};
