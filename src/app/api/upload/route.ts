import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/supabase';
import { rateLimit, RATE_LIMITS } from '@/backend/lib/rate-limit';
import { logger } from '@/backend/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit(`upload:${session.user.id}`, RATE_LIMITS.UPLOAD.limit, RATE_LIMITS.UPLOAD.windowMs);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Upload limit reached. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as 'logos' | 'banners' | 'products' | 'avatars' | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!bucket || !['logos', 'banners', 'products', 'avatars'].includes(bucket)) {
      return NextResponse.json({ error: 'Invalid or missing upload bucket category' }, { status: 400 });
    }

    // Validate file size and type
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file format. Use JPEG, PNG, WEBP, or GIF' }, { status: 400 });
    }

    // Validate magic bytes server-side
    const fileTypeModule = await import('file-type');
    const fromBufferFn = fileTypeModule.fromBuffer || (fileTypeModule as Record<string, { fromBuffer?: unknown }>).default?.fromBuffer;
    if (typeof fromBufferFn !== 'function') {
      throw new Error('file-type fromBuffer is not a function');
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedType = await fromBufferFn(buffer);

    if (!detectedType || !ALLOWED_TYPES.includes(detectedType.mime)) {
      return NextResponse.json({ error: 'File content does not match allowed image formats' }, { status: 400 });
    }

    const publicUrl = await uploadFile(file, bucket);
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    // The real error is logged, never returned. Echoing error.message handed
    // clients internal detail — module resolution failures, storage provider
    // messages, stack-adjacent strings — for no user benefit.
    logger.error('File upload controller error', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again, or use a different image.' },
      { status: 500 }
    );
  }
}
