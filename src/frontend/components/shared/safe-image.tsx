import Image, { type ImageProps } from 'next/image';
import { isAllowedImageUrl } from '@/shared/lib/image-hosts';

/**
 * Drop-in replacement for next/image for any src that comes out of the
 * database.
 *
 * next/image THROWS — it does not warn — when a src points at a host that is
 * not in `images.remotePatterns`. Because the throw happens during render, one
 * bad row took down whichever page rendered that card: the public homepage
 * returned HTTP 500 for every visitor, and the seller's product dashboard
 * showed "Something went wrong" with no way to reach the offending listing.
 *
 * Validation now stops such URLs being stored (see zod-schemas), but rows
 * written before that, or after a storage-host change, still exist. This
 * renders a placeholder for them instead of taking the page with it.
 *
 * Usage: `import { SafeImage as Image } from '@/components/shared/safe-image';`
 * so every image in the file is covered by one line.
 */

function isRenderable(src: ImageProps['src']): boolean {
  // Static imports and local/public assets are always fine.
  if (typeof src !== 'string') return true;
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) return true;
  return isAllowedImageUrl(src);
}

export function SafeImage({ src, alt, ...rest }: ImageProps) {
  if (!isRenderable(src)) {
    // Mirrors the layout props the caller passed so the grid does not shift.
    const { fill, width, height, className, style } = rest;
    return (
      <span
        aria-label={typeof alt === 'string' && alt ? alt : 'Image unavailable'}
        role="img"
        className={className}
        style={
          fill
            ? { position: 'absolute', inset: 0, background: 'var(--muted, #f4f4f5)', ...style }
            : { display: 'inline-block', width, height, background: 'var(--muted, #f4f4f5)', ...style }
        }
      />
    );
  }

  return <Image src={src} alt={alt} {...rest} />;
}

export default SafeImage;
