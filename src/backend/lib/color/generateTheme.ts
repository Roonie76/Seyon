import { hexToHSL, hslToHex } from './colorUtils';

export interface CardTheme {
  bg: string;
  surface: string;
  accent: string;
  accentStrong: string;
  text: string;
  muted: string;
}

export function generateTheme(dominantHex: string): CardTheme {
  const { h, s } = hexToHSL(dominantHex);

  // clamp saturation so very gray/dull images don't produce muddy themes
  const sat = Math.max(s, 25);

  return {
    bg:           hslToHex(h, sat * 0.35, 95),
    surface:      hslToHex(h, sat * 0.45, 90),
    accent:       hslToHex(h, sat * 0.9,  75),
    accentStrong: hslToHex(h, sat,        62),
    text:         hslToHex(h, sat * 0.4,  22),
    muted:        hslToHex(h, sat * 0.25, 86),
  };
}

export function generateDarkTheme(dominantHex: string): CardTheme {
  const { h, s } = hexToHSL(dominantHex);
  const sat = Math.max(s, 25);
  return {
    bg:           hslToHex(h, sat * 0.4, 18),
    surface:      hslToHex(h, sat * 0.45, 24),
    accent:       hslToHex(h, sat * 0.9,  60),
    accentStrong: hslToHex(h, sat,        70),
    text:         hslToHex(h, sat * 0.3,  92),
    muted:        hslToHex(h, sat * 0.25, 32),
  };
}
