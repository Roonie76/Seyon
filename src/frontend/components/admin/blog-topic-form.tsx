'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createBlogTopic, updateBlogTopic } from '@/backend/actions/blog-topics';
import { MAX_TOPIC_SEO_TITLE, MAX_TOPIC_DESCRIPTION } from '@/shared/blog/topic-schema';
import { runAction } from '@/frontend/lib/run-action';
import type { BlogTopic } from '@/types/blog-topic';

interface BlogTopicFormProps {
  initialTopic?: BlogTopic;
  /** Tags already in use by published posts, so a hub can be pointed at real content. */
  availableTags: { tag: string; count: number }[];
  /** How many published posts this hub currently matches. Absent when creating. */
  matchedCount?: number;
}

/** `A, B, C` or one per line — whichever an editor happens to type. */
function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function BlogTopicForm({ initialTopic, availableTags, matchedCount }: BlogTopicFormProps) {
  const router = useRouter();
  const editing = Boolean(initialTopic);

  const [slug, setSlug] = React.useState(initialTopic?.slug ?? '');
  const [label, setLabel] = React.useState(initialTopic?.label ?? '');
  const [heading, setHeading] = React.useState(initialTopic?.heading ?? '');
  const [seoTitle, setSeoTitle] = React.useState(initialTopic?.seoTitle ?? '');
  const [description, setDescription] = React.useState(initialTopic?.description ?? '');
  const [intro, setIntro] = React.useState((initialTopic?.intro ?? []).join('\n\n'));
  const [tags, setTags] = React.useState((initialTopic?.tags ?? []).join(', '));
  const [sortOrder, setSortOrder] = React.useState(String(initialTopic?.sortOrder ?? 0));
  const [published, setPublished] = React.useState(initialTopic?.published ?? true);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const chosenTags = React.useMemo(
    () => new Set(splitList(tags).map((t) => t.toUpperCase())),
    [tags]
  );

  /**
   * How many published posts these tags would pull in, worked out live.
   *
   * A hub matching nothing is a page in the sitemap with no content on it,
   * which is the thin-page shape search engines drop first. Showing the number
   * while the tags are being chosen is the difference between noticing now and
   * noticing in Search Console in three weeks.
   */
  const wouldMatch = React.useMemo(
    () =>
      availableTags
        .filter((t) => chosenTags.has(t.tag.toUpperCase()))
        .reduce((n, t) => Math.max(n, t.count), 0),
    [availableTags, chosenTags]
  );

  const introParagraphs = intro.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const payload = {
      slug: slug.trim().toLowerCase(),
      label: label.trim(),
      heading: heading.trim(),
      seoTitle: seoTitle.trim(),
      description: description.trim(),
      intro: introParagraphs,
      tags: splitList(tags),
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
      published,
    };

    const res = await runAction(() =>
      editing ? updateBlogTopic(initialTopic!.id, payload) : createBlogTopic(payload)
    );

    if (res.error || !res.success) {
      setError(res.error || 'Could not save the hub.');
      setBusy(false);
      return;
    }
    router.push('/admin/blog/topics');
    router.refresh();
  }

  const seoTitleOver = seoTitle.trim().length > MAX_TOPIC_SEO_TITLE;
  const descriptionOver = description.trim().length > MAX_TOPIC_DESCRIPTION;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? 'Edit hub' : 'New hub'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                URL slug
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="jewellery"
                required
              />
              <span className="text-[11px] text-muted-foreground">
                /blog/topic/{slug.trim().toLowerCase() || '…'}
                {editing ? ' — changing this breaks existing links to the old address.' : ''}
              </span>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Label
              </span>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Jewellery"
                required
              />
              <span className="text-[11px] text-muted-foreground">
                Shown on the pills and in the hub grid.
              </span>
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Page heading
            </span>
            <Input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Jewellery worth understanding before you buy it"
              required
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              SEO title
            </span>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              required
              aria-invalid={seoTitleOver}
            />
            <span
              className={`text-[11px] ${seoTitleOver ? 'font-bold text-rose-600' : 'text-muted-foreground'}`}
            >
              {seoTitle.trim().length}/{MAX_TOPIC_SEO_TITLE} — the site appends
              {' “ | Seyon”'}, and anything longer is cut off mid-word in search results.
            </span>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Description
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              aria-invalid={descriptionOver}
            />
            <span
              className={`text-[11px] ${descriptionOver ? 'font-bold text-rose-600' : 'text-muted-foreground'}`}
            >
              {description.trim().length}/{MAX_TOPIC_DESCRIPTION} — used as the meta
              description and as the summary in the hub grid.
            </span>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Introduction
            </span>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={8}
              placeholder={'One paragraph per block.\n\nSeparate them with a blank line.'}
              required
            />
            <span className="text-[11px] text-muted-foreground">
              {introParagraphs.length} paragraph{introParagraphs.length === 1 ? '' : 's'} — a hub
              with nothing but a list of links is a thin page, and thin pages are the first
              thing search engines drop.
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Which posts appear here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-1.5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tags
            </span>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="JEWELLERY, SILVER, GOLD"
            />
          </label>

          {availableTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Tags published posts actually use — click to add:
              </p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map(({ tag, count }) => {
                  const on = chosenTags.has(tag.toUpperCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = splitList(tags).map((t) => t.toUpperCase());
                        setTags(
                          on
                            ? current.filter((t) => t !== tag.toUpperCase()).join(', ')
                            : [...current, tag.toUpperCase()].join(', ')
                        );
                      }}
                      className={`rounded border px-2 py-0.5 text-[11px] font-bold uppercase transition-colors ${
                        on
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {tag} <span className="font-normal opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p
            className={`text-xs font-semibold ${
              chosenTags.size === 0 || wouldMatch === 0 ? 'text-rose-600' : 'text-muted-foreground'
            }`}
          >
            {chosenTags.size === 0
              ? 'No tags chosen, so this hub would show nothing.'
              : wouldMatch === 0
                ? 'These tags match no published post. The hub would be an empty page in the sitemap.'
                : `Matches at least ${wouldMatch} published post${wouldMatch === 1 ? '' : 's'}.`}
            {typeof matchedCount === 'number' && ` Currently showing ${matchedCount}.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Placement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sort order
              </span>
              <Input
                type="number"
                min={0}
                max={999}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">
                Lowest first in the hub grid and the sidebar.
              </span>
            </label>

            <label className="flex items-start gap-2 pt-6">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Published
                <span className="block text-[11px] text-muted-foreground">
                  Unpublishing takes the hub off the site and out of the sitemap, and its
                  address returns a 404 until you publish it again. Nothing is lost — the
                  wording, tags and order are all still here — which is why it is the safer
                  choice when a hub is only being paused.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save hub' : 'Create hub'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/blog/topics">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
