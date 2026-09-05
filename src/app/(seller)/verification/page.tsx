import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getMyKyc } from '@/backend/actions/kyc';
import { KycPanel } from '@/frontend/components/dashboard/kyc-panel';

// Reads the session, so it can never be prerendered. Declared rather than
// discovered: without this Next attempts a static render, fails on headers(),
// and logs an error at build time that looks exactly like a real one.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Verification — Seller Portal',
  description: 'Complete your business details so your store appears in the marketplace.',
};

export default async function VerificationPage() {
  const res = await getMyKyc();

  if ('error' in res) {
    redirect('/login?callbackUrl=/verification');
  }

  if (!res.data.hasShop) {
    return (
      <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="mb-2 text-2xl font-black text-zinc-950">Create your store first</h1>
          <p className="mb-6 text-sm text-zinc-600">
            Verification applies to a storefront, so there needs to be one. It takes a minute.
          </p>
          {/*
            Straight to the form. This used to point at /sell, which is the
            marketing page, whose own button then points at /dashboard — so a
            seller told "create your store first" was sent to be sold the idea
            of a store a second time before being allowed to make one.
          */}
          <Link
            href="/dashboard"
            data-testid="create-store-cta"
            className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800"
          >
            Create my store
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto mb-6 max-w-3xl">
        <h1 className="text-2xl font-black text-zinc-950">Verification</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Two steps. The first lists your store; the second earns the verified badge.
        </p>
      </div>
      <KycPanel initial={res.data} />
    </section>
  );
}
