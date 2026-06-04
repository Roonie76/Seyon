import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadFile(
  file: File,
  bucket: 'logos' | 'banners' | 'products'
): Promise<string> {
  // If we are in local testing or using mock keys, return a nice simulated Unsplash URL
  if (supabaseUrl.includes('mock-project') || !process.env.SUPABASE_URL) {
    console.log('Mock uploading file to Supabase...');
    const randomId = Math.floor(Math.random() * 1000);
    if (bucket === 'logos') {
      return `https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&h=150&q=80&mock=${randomId}`;
    } else if (bucket === 'banners') {
      return `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=400&q=80&mock=${randomId}`;
    } else {
      return `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=450&q=80&mock=${randomId}`;
    }
  }

  // Convert File to ArrayBuffer for Node environment compatibility in Server Actions
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Map file content-type to verified safe extensions to prevent extension spoofing
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const fileExt = mimeToExt[file.type] || 'jpg';
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function deleteFile(
  fileUrl: string,
  bucket: 'logos' | 'banners' | 'products'
): Promise<void> {
  if (supabaseUrl.includes('mock-project') || !process.env.SUPABASE_URL) {
    console.log('Mock deleting file from Supabase:', fileUrl);
    return;
  }

  // Extract path from public URL
  // Example: https://xxx.supabase.co/storage/v1/object/public/products/filename.jpg
  const parts = fileUrl.split(`/storage/v1/object/public/${bucket}/`);
  if (parts.length < 2) return;
  const filePath = parts[1];

  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) {
    console.error(`Supabase deletion error for ${fileUrl}:`, error.message);
  }
}
