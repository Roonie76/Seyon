// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/upload/route';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Product, logo and banner uploads now resolve the caller's shop so the file
// lands in that shop's storage namespace. Without a shop there is nothing to
// attribute the file to, and the route refuses.
vi.mock('@/lib/db', () => ({
  db: { shop: { findUnique: vi.fn().mockResolvedValue({ id: 'shop_1' }) } },
}));

// Mock rateLimit to always succeed during upload tests
vi.mock('@/backend/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10, retryAfterSeconds: 0 }),
  RATE_LIMITS: {
    UPLOAD: { limit: 20, windowMs: 3600000 },
  },
}));

describe('/api/upload API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if user is unauthorized', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 if no file is provided', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);

    const formData = new FormData();
    formData.append('bucket', 'products');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No file provided');
  });

  it('returns 400 if bucket is invalid', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);

    const file = new File([new Uint8Array(262)], 'test.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'invalid-bucket');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid or missing upload bucket category');
  });

  it('rejects files with spoofed type (e.g. HTML disguised as PNG)', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);

    // Malicious HTML content disguised as PNG and padded to 262 bytes
    const htmlContent = '<html><body><script>alert("xss")</script></body></html>'.padEnd(262, ' ');
    const file = new File([new TextEncoder().encode(htmlContent)], 'malicious.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'products');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('File content does not match allowed image formats');
  });

  it('accepts files with valid magic bytes (e.g. real PNG)', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);

    // Real PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A padded to 262 bytes
    const pngBytes = new Uint8Array(262);
    pngBytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const file = new File([pngBytes], 'valid.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'products');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const body = await res.json();
    if (res.status !== 200) {
      console.log('Test failed with status:', res.status, 'body:', body);
    }
    expect(res.status).toBe(200);
    expect(body.url).toContain('https://images.unsplash.com/');
  });

  it('accepts files with valid JPEG magic bytes', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);

    // Real JPEG magic bytes: FF D8 FF padded to 262 bytes
    const jpegBytes = new Uint8Array(262);
    jpegBytes.set([0xFF, 0xD8, 0xFF, 0xE0]);
    const file = new File([jpegBytes], 'valid.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'avatars');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    const body = await res.json();
    if (res.status !== 200) {
      console.log('Test failed with status:', res.status, 'body:', body);
    }
    expect(res.status).toBe(200);
    expect(body.url).toContain('https://images.unsplash.com/');
  });

  it('refuses a store upload from an account with no store', async () => {
    // The route used to accept any signed-in user, so a buyer account could
    // fill the products bucket 20 times an hour with files nothing referenced
    // and nothing could attribute.
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_2' } } as any);
    vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null as never);

    const pngBytes = new Uint8Array(262);
    pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const formData = new FormData();
    formData.append('file', new File([pngBytes], 'x.png', { type: 'image/png' }));
    formData.append('bucket', 'products');

    const req = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/create your store/i);
  });
});
