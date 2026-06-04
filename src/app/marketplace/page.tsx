import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { MarketplaceFilters } from './filters';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Search,
  Filter,
  LayoutGrid,
  Shirt,
  Laptop,
  Sparkles,
  Home,
  Scissors,
  Palette,
  Coffee,
  MoreHorizontal,
  Clock,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  X,
  Tag
} from 'lucide-react';
import { Prisma } from '@prisma/client';

interface MarketplaceProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  shop: { name: string; slug: string; isVerified: boolean };
  images: { url: string }[];
}

interface MarketplacePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  'fashion': Shirt,
  'electronics': Laptop,
  'beauty': Sparkles,
  'home & living': Home,
  'clay crafts': Palette,
  'diy crafts': Scissors,
  'art & collectibles': Palette,
  'food & beverages': Coffee,
};

function CategoryIcon({ category, className, size = 16 }: { category: string; className?: string; size?: number }) {
  const norm = category.toLowerCase().trim();
  const IconComponent = CATEGORY_ICONS[norm] || Tag;
  return <IconComponent className={className} size={size} />;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const params = await searchParams;
  const query = params.q || '';
  const selectedCategory = params.category || '';
  const sort = params.sort || 'newest';
  const page = parseInt(params.page || '1', 10);
  const minPrice = params.minPrice || '';
  const maxPrice = params.maxPrice || '';
  const itemsPerPage = 8;

  let products: MarketplaceProduct[] = [];
  let totalProducts = 0;
  let categories: { name: string; count: number }[] = [];

  try {
    // 1. Fetch available categories dynamically with product counts
    const categoriesRaw = await db.product.groupBy({
      by: ['category'],
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false }
      },
      _count: {
        id: true,
      },
    });
    categories = categoriesRaw.map((c) => ({
      name: c.category,
      count: c._count.id,
    })).sort((a, b) => b.count - a.count); // Sort by popularity

    // 2. Build Prisma filter conditions
    const filterConditions: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      shop: { isSuspended: false },
    };

    if (query) {
      filterConditions.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (selectedCategory) {
      filterConditions.category = selectedCategory;
    }

    if (minPrice || maxPrice) {
      const minVal = parseFloat(minPrice);
      const maxVal = parseFloat(maxPrice);
      const priceFilter: Prisma.FloatFilter = {};
      if (!isNaN(minVal)) priceFilter.gte = minVal;
      if (!isNaN(maxVal)) priceFilter.lte = maxVal;
      filterConditions.price = priceFilter;
    }

    // 3. Determine sorting logic
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'price-asc') orderBy = { price: 'asc' };
    else if (sort === 'price-desc') orderBy = { price: 'desc' };

    // 4. Fetch products matching query with pagination
    [products, totalProducts] = await Promise.all([
      db.product.findMany({
        where: filterConditions,
        include: {
          images: { orderBy: { displayOrder: 'asc' }, take: 1 },
          shop: { select: { name: true, slug: true, isVerified: true } },
        },
        orderBy,
        skip: (page - 1) * itemsPerPage,
        take: itemsPerPage,
      }),
      db.product.count({
        where: filterConditions,
      }),
    ]);
  } catch (error) {
    console.error('Error fetching marketplace products:', error);
  }

  // Fallbacks if database is unmigrated or empty
  let categoriesData = categories;
  if (products.length === 0 && categories.length === 0) {
    categoriesData = [
      { name: 'Electronics', count: 2 },
      { name: 'Fashion', count: 1 },
      { name: 'Home & Living', count: 0 },
      { name: 'Beauty', count: 0 },
    ];
    products = [
      {
        id: '1',
        title: 'Mechanical Keychron K2 Keyboard',
        slug: 'mechanical-keychron-k2-keyboard',
        price: 89.99,
        category: 'Electronics',
        shop: { name: 'Gadget Central', slug: 'gadget-central', isVerified: true },
        images: [{ url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
      {
        id: '2',
        title: 'Sony WH-1000XM4 Headphones',
        slug: 'sony-wh1000xm4-headphones',
        price: 249.50,
        category: 'Electronics',
        shop: { name: 'Gadget Central', slug: 'gadget-central', isVerified: true },
        images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
      {
        id: '3',
        title: 'Oversized Distressed Leather Jacket',
        slug: 'oversized-vintage-leather-jacket',
        price: 135.00,
        category: 'Fashion',
        shop: { name: 'Vogue Boutique', slug: 'vogue-boutique', isVerified: false },
        images: [{ url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
    ];
    totalProducts = products.length;
  }

  const allProductsCount = categoriesData.reduce((sum, c) => sum + c.count, 0);
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const hasActiveFilters = query || selectedCategory || minPrice || maxPrice;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground">
      {/* Header Banner */}
      <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-amber-600/10 p-8 md:p-12 mb-12 overflow-hidden flex flex-col items-center text-center bg-card shadow-sm">
        <div className="absolute top-0 left-0 w-60 h-60 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4 animate-fade-in">
          Discover Seyon Marketplace
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto mb-6">
          Find products listed by independent creators globally. Buy securely by connecting with them directly on chat.
        </p>

        {/* Search Input bar */}
        <form action="/marketplace" method="GET" className="relative w-full max-w-lg">
          <Input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search products, stores, or categories..."
            className="pl-10 pr-20 h-12 rounded-full border-zinc-200 shadow-md bg-white text-foreground focus-visible:ring-amber-500"
          />
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
          <Button type="submit" size="sm" className="absolute right-1.5 top-1.5 h-9 rounded-full px-5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-105 hover:shadow-md transition-all text-black font-bold">
            Search
          </Button>
          {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {minPrice && <input type="hidden" name="minPrice" value={minPrice} />}
          {maxPrice && <input type="hidden" name="maxPrice" value={maxPrice} />}
        </form>
      </div>

      {/* Horizontal Marketplace Filters */}
      <MarketplaceFilters
        categories={categoriesData}
        selectedCategory={selectedCategory}
        sort={sort}
        minPrice={minPrice}
        maxPrice={maxPrice}
        query={query}
      />

      {/* Products Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm text-muted-foreground">
            Showing <span className="text-foreground font-bold">{products.length}</span> of{' '}
            <span className="text-foreground font-bold">{totalProducts}</span> products
          </span>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-200 rounded-xl bg-card shadow-sm">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">No products found</h3>
            <p className="text-sm text-muted-foreground mb-6">Try refining your search terms or filters.</p>
            <Link href="/marketplace">
              <Button variant="outline">Clear All Filters</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((prod) => (
              <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
                <Card className="glass-hover overflow-hidden h-full flex flex-col justify-between cursor-pointer border-zinc-200 bg-card shadow-sm">
                  <div className="relative aspect-video bg-zinc-100 overflow-hidden">
                    {prod.images?.[0] ? (
                      <Image
                        src={prod.images[0].url}
                        alt={prod.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-grow">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-amber-700">
                          {prod.category}
                        </span>
                        <span className="text-xs text-muted-foreground text-right line-clamp-1 max-w-[120px]">
                          by {prod.shop.name}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
                        {prod.title}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
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
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12 border-t border-zinc-200 pt-6">
            <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page - 1}`} className={page === 1 ? 'pointer-events-none opacity-40' : ''}>
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              return (
                <Link key={pNum} href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${pNum}`}>
                  <Button variant={page === pNum ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0">
                    {pNum}
                  </Button>
                </Link>
              );
            })}
            <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page + 1}`} className={page === totalPages ? 'pointer-events-none opacity-40' : ''}>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
export const revalidate = 10; // Caches page for 10 seconds
