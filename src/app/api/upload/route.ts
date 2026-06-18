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

    const rl = rateLimit(`upload:${session.user.id}`, RATE_LIMITS.UPLOAD.limit, RATE_LIMITS.UPLOAD.windowMs);
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

    const publicUrl = await uploadFile(file, bucket);
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error('File upload controller error', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
