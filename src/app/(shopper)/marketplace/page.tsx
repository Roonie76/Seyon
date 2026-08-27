import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace — browse every storefront',
  description:
    'Every independent storefront on Seyon in one place. Filter by category, price and location, and order directly from the seller over WhatsApp.',
  alternates: { canonical: '/marketplace' },
};

interface MarketplacePageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/${qs ? `?${qs}` : ''}`);
}
