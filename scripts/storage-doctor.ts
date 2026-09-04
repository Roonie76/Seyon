/**
 * Does image storage actually work in production?
 *
 * Everything about uploads has been proved locally against a mock: without
 * SUPABASE_URL, `uploadFile` returns a stock Unsplash photo and reports
 * success. So the one thing never tested is the thing that matters — that a
 * real file reaches a real bucket, is readable by a stranger over plain HTTPS,
 * and can be deleted again.
 *
 * This does that round trip for every bucket the application writes to, plus
 * the negative case that matters more than any of them: that an identity
 * document uploaded to `kyc-documents` is NOT readable without credentials.
 *
 * It also catches the failure that prompted it. `StorageBucket` listed
 * 'avatars' and the profile editor uploaded to it, but no such bucket existed
 * in the project — every profile photo change would have failed with "Bucket
 * not found", in production only, with nothing local to reveal it.
 *
 *   npx vercel env pull .env.production.local
 *   npm run storage:doctor
 *
 * Nothing here writes anything a user will see: objects go under a
 * `doctor_<timestamp>` prefix and are removed before the script exits. If it
 * dies halfway, those are the only leftovers and they are named for it.
 */
import { createClient } from '@supabase/supabase-js';

/** Buckets the application writes to, and whether a stranger may read them. */
const BUCKETS: { name: string; publicRead: boolean; why: string }[] = [
  { name: 'logos', publicRead: true, why: 'store logo, shown on every card' },
  { name: 'banners', publicRead: true, why: 'storefront banner' },
  { name: 'products', publicRead: true, why: 'product photos and the OpenGraph image' },
  { name: 'avatars', publicRead: true, why: 'account profile photo' },
  { name: 'kyc-documents', publicRead: false, why: 'identity documents — must NOT be public' },
];

/** The smallest valid PNG: 1x1, transparent. Enough to prove a byte-exact round trip. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || url.includes('mock-project')) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to the real project.\n' +
      'Pull them from the deployment first:  npx vercel env pull .env.production.local'
  );
  process.exit(2);
}

const supabase = createClient(url, key);
const prefix = `doctor_${Date.now()}`;
const failures: string[] = [];
const notes: string[] = [];

function fail(bucket: string, message: string) {
  failures.push(`${bucket}: ${message}`);
  console.log(`  FAIL  ${message}`);
}

async function checkBucket(bucket: string, publicRead: boolean, why: string) {
  console.log(`\n${bucket}  (${why})`);

  const path = `${prefix}/probe.png`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, PNG, { contentType: 'image/png', upsert: false });

  if (upErr) {
    // "Bucket not found" is the one this script exists to catch, so it is
    // named rather than reported as a generic upload failure.
    const missing = /not found/i.test(upErr.message);
    fail(bucket, missing ? `the bucket does not exist in this project (${upErr.message})` : `upload rejected: ${upErr.message}`);
    return;
  }
  console.log('  ok    wrote a file');

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  // Fetched with no Authorization header, deliberately: this is what a buyer's
  // browser — or anyone with the link — actually does.
  const res = await fetch(pub.publicUrl, { cache: 'no-store' });

  if (publicRead) {
    if (!res.ok) {
      fail(bucket, `uploaded, but the public URL returns ${res.status}. Buyers would see a broken image.`);
    } else {
      const got = Buffer.from(await res.arrayBuffer());
      if (!got.equals(PNG)) {
        fail(bucket, `the public URL returned ${got.length} bytes, expected ${PNG.length}. The file came back altered.`);
      } else {
        console.log('  ok    readable by a stranger, byte for byte');
      }
    }
  } else {
    if (res.ok) {
      fail(bucket, `THIS BUCKET IS PUBLIC. Anyone with the URL can read identity documents. Set it to private in the Supabase dashboard now.`);
    } else {
      console.log(`  ok    not publicly readable (${res.status}), which is the point`);
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60);
      if (signErr || !signed) {
        fail(bucket, `private, but a signed URL could not be created either: ${signErr?.message}. Admins could not review documents.`);
      } else {
        const signedRes = await fetch(signed.signedUrl, { cache: 'no-store' });
        if (!signedRes.ok) fail(bucket, `a signed URL returned ${signedRes.status}; document review would be broken`);
        else console.log('  ok    readable with a signed URL, so review still works');
      }
    }
  }

  const { error: delErr } = await supabase.storage.from(bucket).remove([path]);
  if (delErr) {
    fail(bucket, `could not delete the probe file: ${delErr.message}. Left behind at ${path}`);
    return;
  }

  const after = await fetch(pub.publicUrl, { cache: 'no-store' });
  if (publicRead && after.ok) {
    notes.push(`${bucket}: the file still served after deletion — a CDN cache, most likely, not a fault.`);
  }
  console.log('  ok    cleaned up');
}

async function main() {
  console.log(`Storage round trip against ${url}`);
  for (const b of BUCKETS) {
    await checkBucket(b.name, b.publicRead, b.why);
  }

  if (notes.length) {
    console.log('\nNotes:');
    for (const n of notes) console.log(`  - ${n}`);
  }

  if (failures.length) {
    console.log(`\n${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }

  console.log('\nAll buckets write, read and delete correctly. Uploads are proven, not assumed.');
}

main().catch((e) => {
  console.error('\nThe doctor itself failed:', e);
  process.exit(1);
});
