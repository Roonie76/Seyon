export interface ImageInput {
  url: string;
  displayOrder?: number;
  isPrimary?: boolean;
}

export interface NormalisedImage {
  url: string;
  displayOrder: number;
  isPrimary: boolean;
}

/**
 * One ordering, so the cover a seller picks is the cover a buyer sees.
 *
 * There were two competing ideas of "first image" and they disagreed:
 *
 *   `isPrimary`     what the dashboard's star button set, and what the product
 *                   page gallery sorted on.
 *   `displayOrder`  what every public card query ordered by before taking
 *                   `images[0]` — the storefront grid, the marketplace, the
 *                   homepage rails, category pages, related products, and the
 *                   OpenGraph image.
 *
 * So a seller who starred their third photo saw it become the cover in the
 * dashboard, and every buyer kept seeing the first. The OpenGraph one is the
 * worst of those: it is the thumbnail on WhatsApp link previews, which is the
 * whole distribution channel for this marketplace. The control was labelled
 * "COVER" and was a no-op everywhere it mattered.
 *
 * Rather than change nine queries and hope the tenth is found, the two ideas
 * are collapsed here: the primary image is moved to `displayOrder: 0`, so
 * `images[0]` is right by construction and the existing queries become correct
 * without being touched.
 *
 * Normalising on the server rather than trusting the payload also fixes the
 * invariant underneath. `ProductImageSchema` defaults `isPrimary` to `false`,
 * which made the `img.isPrimary ?? (idx === 0)` fallbacks in the actions dead
 * code — a direct action call with no flags produced a product with *zero*
 * primary images, all sharing `displayOrder: 0`, leaving the order to whatever
 * Postgres happened to return. Two primaries were equally accepted. There is no
 * database constraint to catch either.
 */
export function normaliseProductImages(images: ImageInput[]): NormalisedImage[] {
  if (images.length === 0) return [];

  // First explicitly flagged image wins; absent any flag, the first image is
  // the cover, which is what a seller who never touched the control expects.
  const flagged = images.findIndex((img) => img.isPrimary === true);
  const primaryIdx = flagged === -1 ? 0 : flagged;

  const ordered = [images[primaryIdx], ...images.filter((_, i) => i !== primaryIdx)];

  return ordered.map((img, idx) => ({
    url: img.url,
    displayOrder: idx,
    isPrimary: idx === 0,
  }));
}
