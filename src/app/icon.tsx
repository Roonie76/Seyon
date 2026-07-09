import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation using Next.js ImageResponse API
export default function Icon() {
  return new ImageResponse(
    (
      // Renders a sleek circular badge matching Seyon's luxury gold and dark slate color system
      <div
        style={{
          fontSize: 22,
          background: 'hsl(218, 22%, 10%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'hsl(46, 65%, 52%)',
          borderRadius: '50%',
          fontWeight: 800,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          border: '1.5px solid hsl(46, 65%, 52%)',
        }}
      >
        S
      </div>
    ),
    {
      ...size,
    }
  );
}
