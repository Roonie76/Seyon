import { Search } from './Search';
import { RecentPosts } from './RecentPosts';
import { FeaturedProduct } from './FeaturedProduct';
import { Tags } from './Tags';
import { Instagram } from './Instagram';
import { BlogPost } from '@/types/blog';

interface ProductData {
  title: string;
  price: number;
  imageUrl: string | null;
  slug: string;
  shopSlug?: string;
  rating?: number;
}

interface SidebarProps {
  recentPosts: BlogPost[];
  featuredProduct?: ProductData | null;
}

export function Sidebar({
  recentPosts,
  featuredProduct,
}: SidebarProps) {
  return (
    <aside className="w-full lg:w-[380px] space-y-12 shrink-0 lg:sticky lg:top-[100px] pb-12">
      {/* Search Bar - Client side URL param coordinator */}
      <Search />

      {/* Recent Posts */}
      {recentPosts.length > 0 && <RecentPosts posts={recentPosts} />}

      {/* Featured Catalog Product Card */}
      <FeaturedProduct product={featuredProduct} />

      {/* Topic hubs -- real links to real pages, not a query-param filter */}
      <Tags />

      {/* Instagram Grid & Moodboard Collage */}
      <Instagram />
    </aside>
  );
}
