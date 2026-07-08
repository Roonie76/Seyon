import Link from 'next/link';
import { db } from '@/lib/db';
import { BackButton } from '@/components/shared/back-button';
import { generateBreadcrumbJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { logger } from '@/backend/lib/logger';
import { getCategoryProductCount } from '@/lib/demo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse All Categories',
  description:
    'Explore all product categories on Seyon. Find fashion, electronics, beauty, home goods, crafts, and more from independent sellers.',
};

export const revalidate = 60;

// Rotating Hero Banner Configurations
interface BannerConfig {
  imageUrl: string;
  subtitle: string;
}

const HERO_BANNERS: BannerConfig[] = [
  {
    imageUrl: '/category-banner.png', // Generated custom studio collage showing candle, vase, handbag, perfume
    subtitle: 'Thousands of products from creators you already follow—finally organized in one place.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1612195583950-b8fd34c87093?q=80&w=1200&auto=format&fit=crop', // Terracotta pottery & clay crafts focus
    subtitle: 'Discover unique handcrafted pottery and art directly from independent local artisans.',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1200&auto=format&fit=crop', // Warm candles & cozy home decor focus
    subtitle: 'Elevate your living space with curated selections of aesthetic room fragrances and essentials.',
  }
];

// Helper to determine the current calendar week index for dynamic banner rotation
function getRotatingBannerIndex(): number {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return (week % HERO_BANNERS.length);
}

// Overlapping creator avatars displayed in the hero banner
const CREATOR_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop'
];

interface StandardCategoryDef {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  overlayClass: string; // Tailored color overlay tint for visual personality
}

const STANDARD_CATEGORIES: StandardCategoryDef[] = [
  {
    name: 'Fashion',
    slug: 'fashion',
    description: 'Clothing, accessories & footwear',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#A77F3A]', // Warm linen tone tint
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Smart gadgets & tech accessories',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#4B6B94]', // Cool slate tone tint
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Skincare, makeup & fragrances',
    imageUrl: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#C89D9D]', // Soft rose blush tint
  },
  {
    name: 'Home & Living',
    slug: 'home & living',
    description: 'Decor, furniture & essentials',
    imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#DCD4C4]', // Soft warm cream tint
  },
  {
    name: 'Clay Crafts',
    slug: 'clay crafts',
    description: 'Pottery, ceramics & handmade decor',
    imageUrl: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#9E5A38]', // Terracotta tint
  },
  {
    name: 'DIY Crafts',
    slug: 'diy crafts',
    description: 'Handmade supplies & creative tools',
    imageUrl: 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#C8B195]', // Craft neutral tint
  },
  {
    name: 'Art & Collectibles',
    slug: 'art & collectibles',
    description: 'Fine art, prints & gallery collectibles',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#E5E0DB]', // Gallery white/gray tint
  },
  {
    name: 'Food & Beverages',
    slug: 'food & beverages',
    description: 'Gourmet, snacks & artisanal beverages',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop',
    overlayClass: 'bg-[#6B4B38]', // Espresso coffee tint
  }
];

interface PrismaGroupResult {
  category: string;
  _count: {
    id: number;
  };
}

export default async function CategoryIndexPage() {
  let activeProductsGrouped: PrismaGroupResult[] = [];

  try {
    const grouped = await db.product.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE', shop: { isSuspended: false, isPaused: false } },
      _count: { id: true },
    });
    activeProductsGrouped = grouped as unknown as PrismaGroupResult[];
  } catch (error) {
    logger.error('Error fetching categories for index page', error);
  }

  // Create a map of active database categories and their real product counts
  const dbCountMap: Record<string, number> = {};
  activeProductsGrouped.forEach(item => {
    if (item.category) {
      dbCountMap[item.category.toLowerCase().trim()] = item._count.id;
    }
  });

  // Build the list of categories dynamically to ensure future-proofing.
  // 1. Process standard categories
  const resolvedStandardCategories = STANDARD_CATEGORIES.map(cat => {
    const realCount = dbCountMap[cat.slug] || 0;
    const count = getCategoryProductCount(cat.name, realCount);
    return {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      overlayClass: cat.overlayClass,
      count,
    };
  });

  // 2. Append any custom active categories from the database not present in standard list
  const standardSlugs = new Set(STANDARD_CATEGORIES.map(c => c.slug));
  const customCategories: typeof resolvedStandardCategories = [];

  activeProductsGrouped.forEach(item => {
    if (item.category) {
      const slug = item.category.toLowerCase().trim();
      if (!standardSlugs.has(slug)) {
        const realCount = item._count.id;
        const count = getCategoryProductCount(item.category, realCount);
        customCategories.push({
          name: item.category,
          slug: slug,
          description: `Browse curated ${item.category.toLowerCase()} storefronts`,
          imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=600&auto=format&fit=crop', // default fallback
          overlayClass: 'bg-zinc-800/10',
          count,
        });
      }
    }
  });

  // Combine standard and custom active categories
  const allCategories = [...resolvedStandardCategories, ...customCategories];

  const breadcrumbJsonLd = generateBreadcrumbJSONLD([
    { name: 'Marketplace', url: '/marketplace' },
    { name: 'Categories', url: '/category' },
  ]);

  // Determine current rotating hero banner based on the calendar week
  const bannerIndex = getRotatingBannerIndex();
  const selectedBanner = HERO_BANNERS[bannerIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12 animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />

      {/* Page Header Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <BackButton fallbackHref="/" label="Marketplace" className="font-serif !text-base font-bold text-zinc-900 dark:text-white" />
        <Breadcrumbs items={[{ label: 'Categories' }]} />
      </div>

      {/* Category Hero Banner with Dynamic Rotation */}
      <div 
        className="relative rounded-[24px] overflow-hidden min-h-[300px] md:min-h-[360px] flex items-center p-8 md:p-12 shadow-lg transition-all duration-500 bg-right bg-cover bg-no-repeat"
        style={{ backgroundImage: `url(${selectedBanner.imageUrl})` }}
      >
        {/* Soft radial overlay gradient to darken left side for perfect text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/95 via-neutral-950/80 to-transparent z-0" />
        
        <div className="relative z-10 max-w-xl space-y-5">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-serif leading-tight">
              Browse All Categories
            </h1>
            <p className="text-zinc-300 text-sm md:text-base leading-relaxed font-sans max-w-md">
              {selectedBanner.subtitle}
            </p>
          </div>

          {/* Social Proof Creators Stack */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-3 overflow-hidden">
              {CREATOR_AVATARS.map((src, idx) => (
                <div key={idx} className="h-8 w-8 rounded-full border border-[#A77F3A] overflow-hidden bg-zinc-800">
                  <img src={src} alt="Seyon Creator" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-xs md:text-sm font-semibold text-zinc-300">
              <span className="text-[#A77F3A] font-bold">10,000+ creators</span> across India
            </span>
          </div>
        </div>
      </div>

      {/* Main Category Grid Section */}
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-zinc-200/80 pb-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-zinc-950 leading-tight">
              Shop by Category
            </h2>
            <p className="text-zinc-500 text-sm font-sans mt-2">
              Curated collections to help you discover faster
            </p>
          </div>
          <button className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-zinc-200 hover:border-zinc-400 bg-transparent text-zinc-800 hover:text-zinc-950 text-xs md:text-sm font-semibold py-2 px-5 transition-all duration-200 cursor-pointer">
            View all categories
            <span className="text-base leading-none">→</span>
          </button>
        </div>

        {allCategories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">No categories available yet. Check back soon!</p>
          </div>
        ) : (
          /* Responsive 4-column Grid with 24px Card Spacing */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allCategories.map((cat) => (
              <Link 
                key={cat.slug} 
                href={`/category/${encodeURIComponent(cat.slug)}`}
                className="group flex flex-col bg-[#FCFAF7] border border-[#F0ECE3] rounded-[24px] overflow-hidden p-7 md:p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[#A77F3A]/30 hover:shadow-[#A77F3A]/5 cursor-pointer h-full justify-between"
              >
                <div>
                  {/* Hero Visual Image - occupies ~55% of the card height */}
                  <div className="relative aspect-[1.3] w-full overflow-hidden rounded-[18px] mb-5 bg-[#FAF8F5] shrink-0">
                    <img 
                      src={cat.imageUrl} 
                      alt={cat.name} 
                      className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-200"
                    />
                    {/* Visual Color Grading Overlay for Category Personality */}
                    <div className={`absolute inset-0 mix-blend-multiply opacity-[0.12] pointer-events-none rounded-[18px] ${cat.overlayClass}`} />
                  </div>

                  {/* Category Details */}
                  <div className="space-y-1">
                    <h3 className="font-serif text-lg md:text-xl font-bold text-zinc-950 group-hover:text-[#A77F3A] transition-colors duration-150 leading-tight">
                      {cat.name}
                    </h3>
                    <p className="text-zinc-500 text-xs md:text-sm font-sans line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer: Dynamic count + Action Arrow indicator */}
                <div className="flex items-center justify-between pt-6 border-t border-zinc-200/40 mt-5">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {cat.count.toLocaleString()} {cat.count === 1 ? 'Product' : 'Products'}
                  </span>
                  
                  {/* Circular Interaction Arrow - slides right on hover */}
                  <div className="h-9 w-9 rounded-full bg-white shadow-sm border border-zinc-150/80 flex items-center justify-center text-zinc-800 group-hover:bg-[#A77F3A] group-hover:text-white group-hover:border-[#A77F3A] group-hover:translate-x-1.5 transition-all duration-200 shrink-0">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
