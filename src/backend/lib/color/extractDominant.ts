import { Vibrant } from 'node-vibrant/node';

export async function extractDominantColor(imageBuffer: Buffer): Promise<string | null> {
  try {
    const palette = await Vibrant.from(imageBuffer).getPalette();
    const swatch = palette.Vibrant || palette.Muted || palette.DarkVibrant;
    if (!swatch) return null;
    return swatch.hex;
  } catch (err) {
    console.error('Color extraction failed:', err);
    return null;
  }
}
