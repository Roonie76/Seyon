import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const alt = 'Product on Seyon';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}) {
  const { shopSlug, productSlug } = await params;

  let product:
    | {
        title: string;
        price: number;
        compareAtPrice: number | null;
        inStock: boolean;
        images: { url: string }[];
        shop: { name: string };
      }
    | null = null;
  try {
    product = await db.product.findFirst({
      where: {
        slug: productSlug,
        status: 'ACTIVE',
        shop: { slug: shopSlug, isSuspended: false, isPaused: false },
      },
      select: {
        title: true,
        price: true,
        compareAtPrice: true,
        inStock: true,
        images: { orderBy: { displayOrder: 'asc' }, take: 1, select: { url: true } },
        shop: { select: { name: true } },
      },
    });
  } catch {
    // DB unavailable at render time — fall back to generic card
  }

  const title = product?.title || 'Product on Seyon';
  const shopName = product?.shop?.name || 'Seyon Marketplace';
  const imageUrl = product?.images?.[0]?.url;
  const onSale = product?.compareAtPrice != null && product.compareAtPrice > product.price;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#18181b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Product image panel */}
        <div
          style={{
            width: 520,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#27272a',
            overflow: 'hidden',
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" width={520} height={630} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
          ) : (
            <div style={{ fontSize: 120, display: 'flex' }}>🛍️</div>
          )}
        </div>

        {/* Details panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 56,
            background: 'linear-gradient(135deg, #18181b 0%, #27272a 70%, #422006 100%)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 26, color: '#a1a1aa', display: 'flex' }}>{shopName.slice(0, 45)}</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, display: 'flex' }}>{title.slice(0, 70)}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {product && (
              <div style={{ fontSize: 56, fontWeight: 800, color: '#fcd34d', display: 'flex' }}>
                ₹{product.price.toFixed(0)}
              </div>
            )}
            {onSale && product?.compareAtPrice != null && (
              <div style={{ fontSize: 32, color: '#a1a1aa', textDecoration: 'line-through', display: 'flex' }}>
                ₹{product.compareAtPrice.toFixed(0)}
              </div>
            )}
            {product && !product.inStock && (
              <div
                style={{
                  display: 'flex',
                  padding: '8px 20px',
                  borderRadius: 999,
                  background: '#3f3f46',
                  color: '#d4d4d8',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                Sold out
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                padding: '14px 32px',
                borderRadius: 999,
                background: '#059669',
                color: '#ffffff',
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              Chat to Buy on WhatsApp
            </div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#f59e0b' }}>seyon</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
