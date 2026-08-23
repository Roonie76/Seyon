/**
 * Slug generation.
 *
 * The previous implementation used `replace(/[^\w\-]+/g, '')`, and `\w` is
 * `[A-Za-z0-9_]` — so every Tamil, Devanagari, Bengali, Arabic and CJK
 * character was deleted. On a marketplace for Indian creators that is the
 * common case, not an edge case: "மணிமாலை நகை" became "-", the next such
 * title became "-1", and a whitespace-only title became "" — which made the
 * product page unreachable, because /store/<shop>/ resolves to the store.
 *
 * `slugify` keeps Unicode letters and digits (URLs may carry them; browsers
 * display them decoded) and guarantees a non-empty result.
 * `asciiSlug` is the stricter variant for shop handles, which are constrained
 * to /^[a-z0-9-]+$/ by ShopSchema.
 */

/**
 * Fold Latin accents ("Café" → "cafe") WITHOUT touching marks in other
 * scripts. Indic matras, Japanese dakuten and Arabic harakat are all
 * `\p{M}` — stripping them blindly turns "மணிமாலை" into "மணமல" and
 * "キャンドル" into "キャントル". So marks are only removed when they
 * decompose off an ASCII base letter.
 */
function foldLatinAccents(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/([A-Za-z])\p{M}+/gu, '$1')
    .normalize('NFC');
}

function collapse(input: string): string {
  return input
    .replace(/[\s_/\\]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Fallback used when a title contains no sluggable characters at all. */
export const SLUG_FALLBACK = 'product';

/**
 * Unicode-preserving slug for product URLs.
 * Always returns a non-empty string.
 */
export function slugify(text: string): string {
  const cleaned = collapse(
    foldLatinAccents(String(text ?? ''))
      .toLowerCase()
      .trim()
      // Keep letters and numbers from ANY script, plus the separators
      // `collapse` understands. Everything else goes.
      // \p{M} keeps Indic matras, Japanese dakuten and Arabic harakat intact.
      .replace(/[^\p{L}\p{N}\p{M}\s_/\\-]+/gu, '')
  );

  return cleaned.length > 0 ? cleaned.slice(0, 120) : SLUG_FALLBACK;
}

/**
 * ASCII-only slug for shop handles. Returns '' when nothing survives, so the
 * caller can prompt the seller to choose a handle themselves rather than
 * inventing one.
 */
export function asciiSlug(text: string): string {
  return collapse(
    foldLatinAccents(String(text ?? ''))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_/\\-]+/g, '')
  ).slice(0, 100);
}
