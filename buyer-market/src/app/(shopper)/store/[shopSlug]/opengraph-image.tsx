import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const alt = 'Storefront on Seyon';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;

  let shop: { name: string; description: string | null; logo: string | null; city: string | null; region: string | null } | null = null;
  try {
    shop = await db.shop.findUnique({
      where: { slug: shopSlug },
      select: { name: true, description: true, logo: true, city: true, region: true },
    });
  } catch {
    // DB unavailable at render time — fall back to generic card
  }

  const name = shop?.name || 'Seyon Storefront';
  const tagline = shop?.description || 'Chat to buy — order directly on WhatsApp';
  const location = [shop?.city, shop?.region].filter(Boolean).join(', ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #18181b 0%, #27272a 60%, #422006 100%)',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {shop?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.logo}
              alt=""
              width={140}
              height={140}
              style={{ borderRadius: 24, objectFit: 'cover', border: '4px solid #f59e0b' }}
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 24,
                background: 'linear-gradient(to bottom, #fcd34d, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 72,
                fontWeight: 800,
                color: '#18181b',
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{name.slice(0, 40)}</div>
            {location && <div style={{ fontSize: 28, color: '#fcd34d', marginTop: 12 }}>{location}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 30, color: '#d4d4d8', lineHeight: 1.4 }}>
          {tagline.slice(0, 110)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              padding: '14px 32px',
              borderRadius: 999,
              background: '#059669',
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Chat to Buy on WhatsApp
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>seyon</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
