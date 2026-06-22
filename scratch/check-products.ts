import { db } from '../src/backend/lib/db';

async function check() {
  const products = await db.product.findMany({
    select: {
      id: true,
      title: true,
      themeBg: true,
      themeSurface: true,
      themeAccent: true,
      themeAccentStrong: true,
      themeText: true,
      themeMuted: true,
      themeExtractedAt: true,
    }
  });
  console.log(JSON.stringify(products, null, 2));
  process.exit(0);
}

check();
