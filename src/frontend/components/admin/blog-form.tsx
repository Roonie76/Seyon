'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BlogPost, BlogPostInput } from '@/types/blog';
import { createBlogPost, updateBlogPost } from '@/backend/actions/blog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Sparkles, Loader2, Save, Upload } from 'lucide-react';
import Link from 'next/link';
import { parseBlocks } from '@/shared/blog/parse';
import { checkCoverUrl } from '@/shared/blog/cover';
import { PreviewBlocks } from '@/components/blog/preview-blocks';
import { SyntaxGuide } from './syntax-guide';
import { BLOG_TOPICS, topicsForPost } from '@/shared/blog/topics';

/** Every tag that places a post under a hub, de-duplicated, in hub order. */
const HUB_TAGS = Array.from(new Set(BLOG_TOPICS.flatMap((t) => t.tags)));

interface BlogFormProps {
  initialPost?: BlogPost;
}

export function BlogForm({ initialPost }: BlogFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
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

  // Parsed once per keystroke and shared by the preview. The article page runs
  // the same function over the same text, which is the point: the editor
  // cannot advertise a syntax the reader will not get.
  const blocks = useMemo(() => parseBlocks(content), [content]);

  /** Drop a snippet in at the cursor rather than making the writer type it. */
  function insertSnippet(snippet: string) {
    const el = contentRef.current;
    if (!el) {
      setContent((c) => (c ? `${c}\n\n${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? start;
    const before = content.slice(0, start);
    const after = content.slice(end);
    // Block-level snippets need their own paragraph; inline ones do not.
    const isBlock = /^(#|>|-|\d\.|\[shop-the-story)/.test(snippet);
    const lead = isBlock && before && !before.endsWith('\n\n') ? '\n\n' : '';
    const next = `${before}${lead}${snippet}${after}`;
    setContent(next);
    const caret = before.length + lead.length + snippet.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /**
   * Upload a cover rather than paste a link to one.
   *
   * The site's content policy only loads images from Supabase, Unsplash and
   * Google avatars, so a cover from anywhere else is blocked by the browser
   * with no visible error. Uploading puts it in Supabase, which is always
   * allowed. `banners` is reused as the bucket -- a cover is a banner, and a
   * new bucket would be infrastructure for no gain.
   */
  async function uploadCover(file: File) {
    setCoverError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('bucket', 'banners');
      const res = await fetch('/api/upload', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) {
        setCoverError(json?.error || 'Upload failed.');
        return;
      }
      setCover(json.url ?? json.publicUrl ?? '');
    } catch {
      setCoverError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
      if (coverFileRef.current) coverFileRef.current.value = '';
    }
  }

  const coverCheck = cover.trim() ? checkCoverUrl(cover) : { ok: true as const };

  const matchedTopics = topicsForPost(

    tags.split(',').map((t) => t.trim()).filter(Boolean)

  );

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
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-normal normal-case"
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
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="text-xs font-bold uppercase text-foreground">Content</label>
                  <div className="flex rounded-md border border-border overflow-hidden">
                    {(['write', 'preview'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          tab === t
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {tab === 'write' ? (
                  <>
                    <Textarea
                      ref={contentRef}
                      required
                      rows={15}
                      className="font-mono text-xs leading-relaxed"
                      placeholder="Write article here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    <SyntaxGuide onInsert={insertSnippet} />
                  </>
                ) : (
                  <div className="rounded-md border border-border bg-zinc-950 p-3 min-h-[22rem] overflow-y-auto">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
                      {blocks.length} block{blocks.length === 1 ? '' : 's'} — rendered by the same
                      parser the article page uses
                    </p>
                    <PreviewBlocks blocks={blocks} />
                  </div>
                )}
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
                  <p className="text-[11px] text-muted-foreground">Visible to general visitors</p>
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
                  <p className="text-[11px] text-muted-foreground">Pin as main widescreen hero</p>
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
                <label className="text-xs font-bold uppercase text-foreground">Cover Image</label>

                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={uploading}
                  onClick={() => coverFileRef.current?.click()}
                >
                  {uploading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Upload an image</>
                  )}
                </Button>

                <Input
                  required
                  placeholder="…or paste a URL, or a path like /blog/cover.webp"
                  value={cover}
                  onChange={(e) => {
                    setCover(e.target.value);
                    setCoverError(null);
                  }}
                />

                {/* The content policy blocks images from anywhere but this
                    site, Supabase, Unsplash and Google. Say so here rather
                    than letting the reader find an empty hero. */}
                {(coverError || !coverCheck.ok) && (
                  <p className="text-[11px] text-destructive leading-relaxed">
                    {coverError ?? coverCheck.reason}
                  </p>
                )}

                {cover && coverCheck.ok && (
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
                  placeholder="OPERATIONS, SHIPPING"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
                {/* Tags are what place a post under a topic hub, and a post
                    under no hub is reachable only from the index. Showing
                    which tags do that -- and which hubs the current tags
                    resolve to -- is cheaper than an author finding out later
                    that nothing links to their article. */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {HUB_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = tags
                            .split(',')
                            .map((t) => t.trim().toUpperCase())
                            .filter(Boolean);
                          if (current.includes(tag)) return;
                          setTags([...current, tag].join(', '));
                        }}
                        className="rounded border border-border px-2 py-0.5 text-[11px] font-bold uppercase text-muted-foreground hover:bg-muted"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {matchedTopics.length > 0 ? (
                      <>Appears under: {matchedTopics.map((t) => t.label).join(', ')}</>
                    ) : (
                      <>
                        No topic hub matches these tags yet — the post will only be
                        reachable from the blog index.
                      </>
                    )}
                  </p>
                </div>
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
                <p className="text-[11px] text-muted-foreground">
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
