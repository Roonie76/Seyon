import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  const categoryName = slug.charAt(0).toUpperCase() + slug.slice(1);

  return {
    title: `${categoryName} — Buy Direct from Sellers`,
    description: `Shop ${categoryName} from independent sellers on Seyon. Browse the catalog and order directly on WhatsApp.`,
    alternates: {
      canonical: `/category/${encodeURIComponent(slug.toLowerCase())}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const categoryMap: Record<string, string> = {
    'fashion': 'Fashion',
    'electronics': 'Electronics',
    'beauty': 'Beauty',
    'home & living': 'Home & Living',
    'clay crafts': 'Clay Crafts',
    'diy crafts': 'DIY Crafts',
    'art & collectibles': 'Art & Collectibles',
    'food & beverages': 'Food & Beverages'
  };

  const dbCategoryName = categoryMap[slug.toLowerCase()] || (slug.charAt(0).toUpperCase() + slug.slice(1));

  redirect(`/?category=${encodeURIComponent(dbCategoryName)}`);
}

export async function generateStaticParams() {
  return [
    { slug: 'fashion' },
    { slug: 'electronics' },
    { slug: 'beauty' },
    { slug: 'home' },
  ];
}
