import { redirect } from 'next/navigation';

interface MarketplacePageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/${qs ? `?${qs}` : ''}`);
}
