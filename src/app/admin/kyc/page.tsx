import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getKycQueue } from '@/backend/actions/kyc-review';
import { KycQueue } from '@/frontend/components/admin/kyc-queue';
import { KycStatus } from '@prisma/client';

// Reads the session, so it can never be prerendered. Declared rather than
// discovered: without this Next attempts a static render, fails on headers(),
// and logs an error at build time that looks exactly like a real one.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Identity review — Admin',
};

export default async function AdminKycPage() {
  // Role re-read from the database, not the JWT claim: a demoted admin's token
  // stays valid for up to thirty days.
  if (!(await isCurrentUserAdmin())) {
    redirect('/');
  }

  const pending = await getKycQueue(KycStatus.PENDING_REVIEW);
  const items = 'data' in pending ? pending.data : [];

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Identity review</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Oldest first. Approving grants the verified badge; the document is deleted either
              way once a decision is recorded.
            </p>
          </div>
          <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">
            ← Admin
          </Link>
        </div>

        {'error' in pending ? (
          <p role="alert" className="text-xs font-semibold text-red-600">{pending.error}</p>
        ) : (
          <KycQueue items={items} />
        )}
      </div>
    </section>
  );
}
