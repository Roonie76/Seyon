export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  author: string;
  date: Date;
  category: string;
  tags: string[];
  readingTime: number;
  featured: boolean;
  featuredProduct: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  content: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  cover: string;
  author?: string;
  category: string;
  tags: string[];
  readingTime?: number;
  featured?: boolean;
  featuredProduct?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[];
  content: string;
  published?: boolean;
}
