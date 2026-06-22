import { db } from '../src/backend/lib/db';

async function backfill() {
  console.log('Starting product discountPercent backfill...');
  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        compareAtPrice: true,
      }
    });

    console.log(`Found ${products.length} products to process.`);

    let updatedCount = 0;
    for (const product of products) {
      const { id, title, price, compareAtPrice } = product;
      const discountPercent =
        compareAtPrice && compareAtPrice > price
          ? (compareAtPrice - price) / compareAtPrice
          : null;

      console.log(`Product "${title}" (${id}): price=${price}, compareAtPrice=${compareAtPrice} -> discountPercent=${discountPercent}`);

      await db.product.update({
        where: { id },
        data: { discountPercent },
      });
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} products.`);
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    process.exit(0);
  }
}

backfill();
