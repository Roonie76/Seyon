import { db } from '@/lib/db';
import Link from 'next/link';
import { HeroBanner } from '@/components/blog/HeroBanner/HeroBanner';
import { FeaturedStory } from '@/components/blog/FeaturedStory/FeaturedStory';
import { BlogCard } from '@/components/blog/BlogCard/BlogCard';
import { Sidebar } from '@/components/blog/Sidebar/Sidebar';
import { Pagination } from '@/components/blog/Pagination/Pagination';
import { BlogPost } from '@/types/blog';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Seyon Blog — Luxury Stories & Craftsmanship Guides',
  description:
    'Discover editorial stories, design craftsmanship insights, and guides to direct selling and buyer trust on Seyon.',
  alternates: { canonical: '/blog' },
};

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const { q, tag, page } = await searchParams;
  const currentPage = Number(page || '1');
  const postsPerPage = 6;

  // Build DB queries
  const queryFilter = q
    ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { excerpt: { contains: q, mode: 'insensitive' as const } },
          { content: { contains: q, mode: 'insensitive' as const } },
          { category: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const tagFilter = tag
    ? {
        tags: { has: tag.toUpperCase() },
      }
    : {};

  // Fetch blogs in parallel
  const [postsRaw, totalCount, tagPosts, recentPostsRaw] = await Promise.all([
    db.blogPost.findMany({
      where: {
        published: true,
        ...queryFilter,
        ...tagFilter,
      },
      orderBy: [
        { featured: 'desc' },
        { date: 'desc' },
      ],
      skip: (currentPage - 1) * postsPerPage,
      take: postsPerPage,
    }),
    db.blogPost.count({
      where: {
        published: true,
        ...queryFilter,
        ...tagFilter,
      },
    }),
    db.blogPost.findMany({
      where: { published: true },
      select: { tags: true },
      take: 100,
    }),
    db.blogPost.findMany({
      where: { published: true },
      orderBy: { date: 'desc' },
      take: 3,
    }),
  ]);

  // Cast type definitions
  const posts = postsRaw as unknown as BlogPost[];
  const recentPosts = recentPostsRaw as unknown as BlogPost[];

  // Flatten and filter unique tags
  const tagsList = Array.from(new Set(tagPosts.flatMap((p) => p.tags)));

  const totalPages = Math.ceil(totalCount / postsPerPage);

  // Isolate featured post for the top banner (Only show on page 1, when no search/tag filter is active)
  const isFiltering = !!(q || tag);
  const featuredPost = !isFiltering && currentPage === 1 ? posts.find((p) => p.featured) || posts[0] : null;

  // Filter out the featured post from the grid if displayed
  const gridPosts = featuredPost
    ? posts.filter((p) => p.id !== featuredPost.id)
    : posts;

  // Fetch product for sidebar from the featured post or the first post
  let sidebarProduct = null;
  const productSourcePost = featuredPost || posts[0];
  if (productSourcePost && productSourcePost.featuredProduct) {
    const dbProduct = await db.product.findFirst({
      where: {
        slug: productSourcePost.featuredProduct,
        status: 'ACTIVE',
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { slug: true } },
      },
    });

    if (dbProduct) {
      sidebarProduct = {
        title: dbProduct.title,
        price: dbProduct.price,
        imageUrl: dbProduct.images[0]?.url || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=400',
        slug: dbProduct.slug,
        shopSlug: dbProduct.shop.slug,
        rating: 5,
      };
    }
  }

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] text-zinc-350 min-h-screen">
      {/* Background Styling: Double grid lines + Radial centered gold glow */}
      <style dangerouslySetInnerHTML={{ __html: `
        .luxury-bg {
          background-color: #050505;
          background-image: 
            radial-gradient(circle at top, rgba(212, 175, 55, 0.07), transparent 45%),
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 100% 100%, 120px 120px, 120px 120px;
        }
      `}} />

      <div className="luxury-bg absolute inset-0 pointer-events-none z-0" />

      {/* Hero Banner Title (Mouse Parallax) */}
      <HeroBanner />

      {/* Main Grid Wrapper */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 sm:py-24">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          
          {/* Left Main Article Column (70%) */}
          <div className="flex-grow w-full lg:max-w-[calc(100%-420px)] space-y-12">
            
            {/* Featured Post (Only show on page 1 without search/filter) */}
            {featuredPost && (
              <FeaturedStory post={featuredPost} />
            )}

            {/* Grid Title */}
            {isFiltering && (
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-light text-white font-serif uppercase tracking-wider">
                  Search Results {q && `for "${q}"`} {tag && `tagged "${tag}"`} ({totalCount})
                </h3>
              </div>
            )}

            {/* Articles Grid */}
            {gridPosts.length === 0 ? (
              <div className="text-center py-20 border border-zinc-900 bg-[#0f0f0f] rounded-3xl space-y-4">
                <p className="text-sm text-zinc-500 font-light">No articles match your search criteria.</p>
                <Link href="/blog" className="inline-block text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37] hover:underline">
                  Clear Filters
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {gridPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            <Pagination totalPages={totalPages} />
          </div>

          {/* Right Sidebar Column (30%) */}
          <Sidebar
            recentPosts={recentPosts}
            tags={tagsList}
            featuredProduct={sidebarProduct}
          />
        </div>
      </div>
    </div>
  );
}
