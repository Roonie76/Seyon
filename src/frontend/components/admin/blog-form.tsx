'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BlogPost, BlogPostInput } from '@/types/blog';
import { createBlogPost, updateBlogPost } from '@/backend/actions/blog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Sparkles, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

interface BlogFormProps {
  initialPost?: BlogPost;
}

export function BlogForm({ initialPost }: BlogFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form Fields State
  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || '');
  const [cover, setCover] = useState(initialPost?.cover || '');
  const [author, setAuthor] = useState(initialPost?.author || 'Seyon Team');
  const [category, setCategory] = useState(initialPost?.category || 'Strategy');
  const [tags, setTags] = useState(initialPost?.tags.join(', ') || '');
  const [content, setContent] = useState(initialPost?.content || '');
  const [featured, setFeatured] = useState(initialPost?.featured ?? false);
  const [featuredProduct, setFeaturedProduct] = useState(initialPost?.featuredProduct || '');
  const [published, setPublished] = useState(initialPost?.published ?? true);

  // SEO Fields State
  const [seoTitle, setSeoTitle] = useState(initialPost?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(initialPost?.seoDescription || '');
  const [seoKeywords, setSeoKeywords] = useState(initialPost?.seoKeywords.join(', ') || '');

  // Auto-generate slug from title
  const generateSlug = () => {
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars
      .replace(/[\s_]+/g, '-')     // replace spaces and underscores with hyphens
      .replace(/-+/g, '-');        // replace multiple hyphens with single hyphen
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Format tags & keywords
    const tagsArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const seoKeywordsArray = seoKeywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const blogInput: BlogPostInput = {
      title,
      slug,
      excerpt,
      cover,
      author,
      category,
      tags: tagsArray,
      content,
      featured,
      featuredProduct: featuredProduct.trim() || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoKeywords: seoKeywordsArray,
      published,
    };

    try {
      let result;
      if (initialPost) {
        result = await updateBlogPost(initialPost.id, blogInput);
      } else {
        result = await createBlogPost(blogInput);
      }

      if (result.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => {
          router.push('/admin/blog');
        }, 1500);
      } else {
        setError(result.error || 'Failed to save blog post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href="/admin/blog"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Blog Manager
          </Link>
          <h2 className="text-2xl font-bold text-foreground">
            {initialPost ? `Edit: ${initialPost.title}` : 'Write New Luxury Article'}
          </h2>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push('/admin/blog')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
            {initialPost ? 'Update Post' : 'Publish Post'}
          </Button>
        </div>
      </div>

      {/* Message Banners */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-4 text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg p-4 text-sm font-medium">
          Success! Blog post saved. Redirecting...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Article Body
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">Title</label>
                <Input
                  required
                  placeholder="e.g. How Craftsmanship Defines Luxury"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-foreground flex items-center justify-between">
                    Slug
                    <button
                      type="button"
                      onClick={generateSlug}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-normal normal-case"
                    >
                      <Sparkles size={10} /> Auto-generate
                    </button>
                  </label>
                  <Input
                    required
                    placeholder="how-craftsmanship-defines-luxury"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-foreground">Category</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Strategy">Strategy</option>
                    <option value="Guide">Guide</option>
                    <option value="Trust">Trust</option>
                    <option value="Craftsmanship">Craftsmanship</option>
                    <option value="Aesthetics">Aesthetics</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">Excerpt</label>
                <Textarea
                  required
                  rows={2}
                  placeholder="Short engaging excerpt summarizing the post for grid cards..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">
                  Content (Markdown Supported)
                </label>
                <div className="text-[10px] text-muted-foreground bg-zinc-950 p-2.5 rounded-md mb-2 space-y-1 border border-border">
                  <p>✏️ <strong>Standard Markdown</strong>: Use <code>## Header</code> for sections, normal text for paragraphs, and <code>&gt; quote</code> for blockquotes.</p>
                  <p>🛍️ <strong>Shop-The-Story Integration</strong>: Add <code>[shop-the-story:product-slug]</code> on its own line to embed an interactive product checkout card in-article!</p>
                </div>
                <Textarea
                  required
                  rows={15}
                  className="font-mono text-xs leading-relaxed"
                  placeholder="Write article here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* SEO Meta Fields */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                SEO & Meta Optimization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">SEO Meta Title</label>
                <Input
                  placeholder="If empty, defaults to Title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">SEO Meta Description</label>
                <Textarea
                  rows={2}
                  placeholder="If empty, defaults to Excerpt"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">SEO Keywords (Comma Separated)</label>
                <Input
                  placeholder="luxury, diamond, gold, handmade, seyon"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Settings & Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-3 border border-border/60 bg-zinc-950/20 rounded-lg">
                <div>
                  <p className="text-xs font-bold uppercase text-foreground">Published</p>
                  <p className="text-[10px] text-muted-foreground">Visible to general visitors</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-black text-primary focus:ring-primary focus:ring-offset-black"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-border/60 bg-zinc-950/20 rounded-lg">
                <div>
                  <p className="text-xs font-bold uppercase text-foreground">Featured</p>
                  <p className="text-[10px] text-muted-foreground">Pin as main widescreen hero</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-black text-primary focus:ring-primary focus:ring-offset-black"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">Author</label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">Cover Image (URL)</label>
                <Input
                  required
                  placeholder="https://images.unsplash.com/photo-..."
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                />
                {cover && (
                  <div className="mt-2 rounded-lg border border-border overflow-hidden h-28 relative bg-zinc-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">Tags (Comma Separated)</label>
                <Input
                  placeholder="GOLD, JEWELRY, TRENDS"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-foreground">
                  Shop-the-story Product Slug
                </label>
                <Input
                  placeholder="e.g. fl-15"
                  value={featuredProduct}
                  onChange={(e) => setFeaturedProduct(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Associates a shop product to this article for conversion tracking and calls to action.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
