import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/backend/lib/session';
import { getMyNotices } from '@/backend/actions/notices';
import { NoticeInbox } from '@/frontend/components/dashboard/notice-inbox';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Notices',
  robots: { index: false, follow: false },
};

export default async function NoticesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/login');

  const res = await getMyNotices();

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Notices</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Anything the Seyon team has formally sent you about your storefront. This page is the
              record — an email may not have reached you, but a notice here always did.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 text-xs font-bold text-[#A77F3A] hover:underline">
            ← Dashboard
          </Link>
        </div>

        {'error' in res ? (
          <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
        ) : (
          <NoticeInbox notices={res.data} />
        )}
      </div>
    </section>
  );
}
