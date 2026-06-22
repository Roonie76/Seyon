import { db } from '../src/backend/lib/db';
import { extractDominantColor } from '../src/backend/lib/color/extractDominant';
import { generateTheme } from '../src/backend/lib/color/generateTheme';

async function backfill() {
  console.log('Starting product theme backfill...');
  try {
    const products = await db.product.findMany({
      include: {
        images: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    console.log(`Found ${products.length} products to process.`);

    for (const product of products) {
      const primaryImage = product.images.find((img: { isPrimary: boolean }) => img.isPrimary) || product.images[0];
      if (!primaryImage) {
        console.log(`Skipping product ${product.id} (no images found).`);
        continue;
      }

      console.log(`Processing product ${product.id} (${product.title}) with image: ${primaryImage.url}`);

      try {
        const response = await fetch(primaryImage.url);
        if (!response.ok) {
          console.error(`Failed to fetch image ${primaryImage.url}: ${response.statusText}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const dominantColor = await extractDominantColor(buffer);
        if (!dominantColor) {
          console.error(`Could not extract dominant color for product ${product.id}`);
          continue;
        }

        const lightTheme = generateTheme(dominantColor);

        await db.product.update({
          where: { id: product.id },
          data: {
            themeBg: lightTheme.bg,
            themeSurface: lightTheme.surface,
            themeAccent: lightTheme.accent,
            themeAccentStrong: lightTheme.accentStrong,
            themeText: lightTheme.text,
            themeMuted: lightTheme.muted,
            themeExtractedAt: new Date()
          }
        });

        console.log(`Successfully updated product ${product.id} theme.`);
      } catch (err) {
        console.error(`Error processing product ${product.id}:`, err);
      }
    }

    console.log('Backfill process complete.');
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    process.exit(0);
  }
}

backfill();
