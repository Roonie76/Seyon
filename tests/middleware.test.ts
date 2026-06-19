import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware as rootMiddleware } from '../src/middleware';

describe('Root Middleware Routing and Domain Redirection', () => {
  it('redirects to the buyer market when a shopper route is accessed on a seller domain', () => {
    const req = new NextRequest(new URL('https://seyon-seller.vercel.app/store/pasteldreams'));
    req.headers.set('host', 'seyon-seller.vercel.app');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    // It should be a redirect response (status 307/308)
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://seyon-pied.vercel.app/store/pasteldreams');
  });

  it('redirects to the seller homepage when root path is accessed on a seller domain', () => {
    const req = new NextRequest(new URL('https://seyon-seller.vercel.app/'));
    req.headers.set('host', 'seyon-seller.vercel.app');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://seyon-seller.vercel.app/sell');
  });

  it('allows access to seller dashboard on the seller domain', () => {
    const req = new NextRequest(new URL('https://seyon-seller.vercel.app/dashboard'));
    req.headers.set('host', 'seyon-seller.vercel.app');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('allows access to shopper routes on the buyer domain', () => {
    const req = new NextRequest(new URL('https://seyon-pied.vercel.app/store/pasteldreams'));
    req.headers.set('host', 'seyon-pied.vercel.app');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('blocks access to seller-only dashboard on the buyer domain', () => {
    const req = new NextRequest(new URL('https://seyon-pied.vercel.app/dashboard'));
    req.headers.set('host', 'seyon-pied.vercel.app');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://seyon-pied.vercel.app/404');
  });
});

describe('Root Middleware Host Detection (SELLER_HOSTS)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does NOT treat a buyer domain containing "sell" as a seller host', () => {
    // Regression: old substring matching misclassified hosts like this one
    const req = new NextRequest(new URL('https://bestseller-boutique.com/store/pasteldreams'));
    req.headers.set('host', 'bestseller-boutique.com');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('respects hosts configured via SELLER_HOSTS env var', () => {
    vi.stubEnv('SELLER_HOSTS', 'sell.seyon.in, custom-seller.example.com');

    const req = new NextRequest(new URL('https://custom-seller.example.com/'));
    req.headers.set('host', 'custom-seller.example.com');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://custom-seller.example.com/sell');
  });

  it('matches seller hosts when the Host header includes a port', () => {
    vi.stubEnv('SELLER_HOSTS', 'sell.seyon.in');

    const req = new NextRequest(new URL('http://sell.seyon.in:8080/'));
    req.headers.set('host', 'sell.seyon.in:8080');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect([307, 308]).toContain(res.status);
  });

  it('treats hosts not in SELLER_HOSTS as buyer domains', () => {
    vi.stubEnv('SELLER_HOSTS', 'sell.seyon.in');

    const req = new NextRequest(new URL('https://seyon.in/dashboard'));
    req.headers.set('host', 'seyon.in');

    const res = rootMiddleware(req) as any;

    expect(res).toBeDefined();
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://seyon.in/404');
  });
});
