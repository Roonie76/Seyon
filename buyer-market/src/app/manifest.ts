import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Seyon — Social Commerce Storefronts',
    short_name: 'Seyon',
    description: 'Shop direct from independent sellers. Chat to buy on WhatsApp.',
    start_url: '/marketplace',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
    ],
  };
}
