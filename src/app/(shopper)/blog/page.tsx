import { db } from '@/lib/db';
import Link from 'next/link';
import { HeroBanner } from '@/components/blog/HeroBanner/HeroBanner';
import { FeaturedStory } from '@/components/blog/FeaturedStory/FeaturedStory';
import { BlogCard } from '@/components/blog/BlogCard/BlogCard';
import { Sidebar } from '@/components/blog/Sidebar/Sidebar';
import { Pagination } from '@/components/blog/Pagination/Pagination';
import { BlogPost } from '@/types/blog';
import type { Metadata } from 'next';
import { BLOG_TOPICS } from '@/shared/blog/topics';
import {
  generateBlogJSONLD,
  generateBreadcrumbJSONLD,
  safeJsonLdStringify,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * The old title and description described an editorial magazine about
 * craftsmanship. What is actually published here are practical guides for
 * people selling on Instagram and WhatsApp in India, which is also what
 * anyone arriving from a search is looking for. A title that does not match
 * the page costs the click.
 */
export const metadata: Metadata = {
  title: 'Blog — Guides for Independent Sellers in India',
  description:
    'Practical guides for independent sellers in India: selling on Instagram and WhatsApp, pricing, product photography, shipping, returns, GST and earning buyer trust.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Seyon Blog — Guides for Independent Sellers in India',
    description:
      'Practical guides for independent sellers in India: selling on Instagram and WhatsApp, pricing, photography, shipping, returns and buyer trust.',
    type: 'website',
    url: '/blog',
  },
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
  const [postsRaw, totalCount, recentPostsRaw] = await Promise.all([
    db.blogPost.findMany({
      where: {
        published: true,
        ...queryFilter,
        ...tagFilter,
      },
      // `id` is the tie-break. Ordering by `date` alone is not deterministic
      // when posts share a timestamp, and offset paging over a non-deterministic
      // order silently drops rows and repeats others between pages.
      orderBy: [
        { featured: 'desc' },
        { date: 'desc' },
        { id: 'desc' },
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
      orderBy: { date: 'desc' },
      take: 3,
    }),
  ]);

  // Cast type definitions
  const posts = postsRaw as unknown as BlogPost[];
  const recentPosts = recentPostsRaw as unknown as BlogPost[];

  const totalPages = Math.ceil(totalCount / postsPerPage);

  /**
   * Structured data for the index. Emitted only on the unfiltered first page:
   * a search or tag view is a slice of the same collection, and publishing a
   * Blog schema for each of them describes several blogs that do not exist.
   */
  const emitSchema = !q && !tag && currentPage === 1;
  const blogSchema = emitSchema
    ? generateBlogJSONLD(
        'Seyon Blog',
        'Practical guides for independent sellers in India.',
        '/blog',
        postsRaw.map((p) => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          date: p.date,
        }))
      )
    : null;
  const breadcrumbSchema = emitSchema
    ? generateBreadcrumbJSONLD([
        { name: 'Home', url: '/' },
        { name: 'Blog', url: '/blog' },
      ])
    : null;

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
        // averageRating is the shop's, maintained from real reviews. The card
        // used to be handed a literal 5 regardless.
        shop: { select: { slug: true, averageRating: true, reviewCount: true } },
      },
    });

    if (dbProduct) {
      sidebarProduct = {
        title: dbProduct.title,
        price: dbProduct.price,
        imageUrl: dbProduct.images[0]?.url ?? null,
        slug: dbProduct.slug,
        shopSlug: dbProduct.shop.slug,
        // Undefined rather than a made-up number when nobody has reviewed it.
        rating: dbProduct.shop.reviewCount > 0 ? dbProduct.shop.averageRating : undefined,
      };
    }
  }

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] text-zinc-350 min-h-screen">
      {blogSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbSchema) }}
        />
      )}

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

            {/* Topic hubs.
                These are the only links on the site into /blog/topic/*, so
                they are also the crawl path to every cluster page. Shown on
                the unfiltered index only: inside a search result they compete
                with the thing the reader is looking at. */}
            {!isFiltering && currentPage === 1 && (
              <nav aria-label="Blog topics" className="space-y-6">
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
                  Browse by topic
                </h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  {BLOG_TOPICS.map((topic) => (
                    <Link
                      key={topic.slug}
                      href={`/blog/topic/${topic.slug}`}
                      className="group block rounded-3xl border border-zinc-900 bg-[#0f0f0f] p-6 transition-all duration-300 hover:border-zinc-800 hover:-translate-y-0.5"
                    >
                      <h3 className="text-lg font-light text-white font-serif uppercase tracking-tight group-hover:text-[#E4C29D] transition-colors">
                        {topic.label}
                      </h3>
                      <p className="mt-3 text-sm text-[#9D9D9D] font-light leading-relaxed line-clamp-3">
                        {topic.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </nav>
            )}

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
                {isFiltering ? (
                  <>
                    <p className="text-sm text-zinc-500 font-light">
                      No articles match your search criteria.
                    </p>
                    <Link
                      href="/blog"
                      className="inline-block text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37] hover:underline"
                    >
                      Clear Filters
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-400 font-light">
                      No stories published yet.
                    </p>
                    <p className="text-xs text-zinc-600 font-light max-w-sm mx-auto">
                      The first editorial pieces are being written. Come back shortly, or
                      browse the marketplace in the meantime.
                    </p>
                    <Link
                      href="/marketplace"
                      className="inline-block text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37] hover:underline"
                    >
                      Explore the marketplace
                    </Link>
                  </>
                )}
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
            featuredProduct={sidebarProduct}
          />
        </div>
      </div>
    </div>
  );
}
