import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

interface CategoryProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  shop: { name: string; slug: string; isVerified: boolean };
  images: { url: string }[];
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  // Format slug for title (e.g. electronics -> Electronics)
  const categoryName = slug.charAt(0).toUpperCase() + slug.slice(1);

  let products: CategoryProduct[] = [];
  try {
    products = await db.product.findMany({
      where: {
        category: { equals: categoryName, mode: 'insensitive' },
        status: 'ACTIVE',
        shop: { isSuspended: false },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching category products:', error);
  }

  // Fallback for mock presentation
  if (products.length === 0 && ['electronics', 'fashion', 'beauty', 'home'].includes(slug.toLowerCase())) {
    products = [
      {
        id: 'mock-c1',
        title: `Premium Item under ${categoryName}`,
        slug: `premium-item-under-${slug}`,
        price: 99.99,
        category: categoryName,
        shop: { name: 'Demo Store', slug: 'demo-store', isVerified: true },
        images: [{ url: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
    ];
  }

  // Show 404 if no products listed under this category
  if (products.length === 0) {
    return notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Back button */}
      <Link href="/marketplace" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900 p-8 md:p-12 mb-12 overflow-hidden shadow-lg">
        <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
          {categoryName} Department
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Browse our curated list of {categoryName} items. Order directly through instant chats.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {products.map((prod) => (
          <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
            <Card className="glass-hover overflow-hidden h-full flex flex-col justify-between cursor-pointer border-border bg-card">
              <div className="relative aspect-video bg-neutral-100 overflow-hidden">
                {prod.images?.[0] ? (
                  <Image
                    src={prod.images[0].url}
                    alt={prod.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col justify-between flex-grow">
                <div>
                  <span className="text-[10px] uppercase font-bold text-primary mb-1 block">
                    {prod.category}
                  </span>
                  <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1">
                    {prod.title}
                  </h3>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Sold by {prod.shop.name}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-extrabold text-foreground text-base">
                    ₹{prod.price.toFixed(2)}
                  </span>
                  <Badge variant="success" className="text-[10px] font-bold">
                    WhatsApp Buy
                  </Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
export const revalidate = 60;
export async function generateStaticParams() {
  // Return standard categories for ISR pre-building
  return [
    { slug: 'fashion' },
    { slug: 'electronics' },
    { slug: 'beauty' },
    { slug: 'home' },
  ];
}
