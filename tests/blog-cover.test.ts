import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCoverUrl } from '../src/shared/blog/cover';

/**
 * A cover from an unlisted host is blocked by the Content-Security-Policy and
 * fails silently in the browser. This check moves the failure to the moment
 * the author pastes it, where it can be explained.
 */
describe('checkCoverUrl', () => {
  it('accepts Supabase storage, whatever the project ref', () => {
    expect(checkCoverUrl('https://wcmldqrlppclprpcyjso.supabase.co/storage/v1/object/public/banners/x.jpg').ok).toBe(true);
  });

  it('accepts the two external hosts the policy allows', () => {
    expect(checkCoverUrl('https://images.unsplash.com/photo-1?q=80').ok).toBe(true);
    expect(checkCoverUrl('https://lh3.googleusercontent.com/a/x').ok).toBe(true);
  });

  it('refuses a host the policy would block, and names it', () => {
    const result = checkCoverUrl('https://i.imgur.com/abc.jpg');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('i.imgur.com');
  });

  it('refuses a lookalike host', () => {
    // "notsupabase.co" must not pass a suffix check for ".supabase.co".
    expect(checkCoverUrl('https://evil-supabase.co.attacker.test/x.jpg').ok).toBe(false);
  });

  it('refuses http', () => {
    expect(checkCoverUrl('http://images.unsplash.com/photo-1').ok).toBe(false);
  });

  it('refuses a non-URL', () => {
    expect(checkCoverUrl('not a url').ok).toBe(false);
  });

  it('refuses an empty value', () => {
    expect(checkCoverUrl('').ok).toBe(false);
    expect(checkCoverUrl('   ').ok).toBe(false);
  });

  it('is case-insensitive about the host', () => {
    expect(checkCoverUrl('https://Images.Unsplash.COM/photo-1').ok).toBe(true);
  });
});

describe('local cover paths', () => {
  it('accepts a root-relative path to a cover we ship', () => {
    expect(checkCoverUrl('/blog/how-to-sell-on-instagram-in-india.webp')).toEqual({ ok: true });
    expect(checkCoverUrl('/blog/nested/cover.webp')).toEqual({ ok: true });
  });

  it('rejects a protocol-relative URL wearing a relative path as a disguise', () => {
    const result = checkCoverUrl('//evil.example.com/cover.jpg');
    expect(result.ok).toBe(false);
  });

  it('rejects a local path with characters that do not belong in one', () => {
    expect(checkCoverUrl('/blog/a b.webp').ok).toBe(false);
    expect(checkCoverUrl('/blog/<script>.webp').ok).toBe(false);
    expect(checkCoverUrl('/blog/x.webp?onerror=1').ok).toBe(false);
  });

  it('rejects a local path that is not an image file', () => {
    expect(checkCoverUrl('/').ok).toBe(false);
    expect(checkCoverUrl('/blog').ok).toBe(false);
    expect(checkCoverUrl('/blog/cover.txt').ok).toBe(false);
  });

  it('still rejects an empty value', () => {
    expect(checkCoverUrl('').ok).toBe(false);
    expect(checkCoverUrl('   ').ok).toBe(false);
  });
});

/**
 * Covers are photographs now, and photographs are heavy.
 *
 * The thirteen editorial covers added in e1b0a4b are 62-102KB against the
 * 8-29KB of the generated ones they replaced. Rendered through a raw `<img>`
 * the full file shipped at every size: measured on the photograph-heavy page
 * of the index, 712KB of images and an LCP of 3.3s, against 176KB and 1.5s for
 * the same page of generated covers. Through next/image at the size each slot
 * actually renders: 195KB and 1.0s.
 */
describe('blog covers are served at the size they are rendered', () => {
  const files: Array<[label: string, path: string]> = [
    ['card', 'src/frontend/components/blog/BlogCard/BlogCard.tsx'],
    ['featured story', 'src/frontend/components/blog/FeaturedStory/FeaturedStory.tsx'],
    ['article hero', 'src/app/(shopper)/blog/[slug]/page.tsx'],
  ];

  it.each(files)('%s renders the cover through next/image', (_label, file) => {
    const src = readFileSync(join(__dirname, '..', file), 'utf8');
    expect(src).toContain("from '@/components/shared/safe-image'");
    // A raw <img> for the cover is the regression: it bypasses the optimiser.
    expect(src).not.toMatch(/<img\s+[\s\S]{0,120}src=\{post\.cover\}/);
  });

  it.each(files)('%s tells the optimiser what width it needs', (_label, file) => {
    // Without `sizes`, next/image assumes 100vw and picks the largest
    // candidate, which gives back the whole saving.
    const src = readFileSync(join(__dirname, '..', file), 'utf8');
    expect(src).toMatch(/sizes="[^"]+"/);
  });

  it('the two above-the-fold covers are not lazy', () => {
    for (const file of [
      'src/frontend/components/blog/FeaturedStory/FeaturedStory.tsx',
      'src/app/(shopper)/blog/[slug]/page.tsx',
    ]) {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(src, file).toMatch(/\bpriority\b/);
    }
  });
});
