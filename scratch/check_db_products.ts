import { db } from '../src/backend/lib/db';

async function main() {
  console.log('Querying database for products by price or draft status...');
  
  const products = await db.product.findMany({
    where: {
      OR: [
        { price: 1.00 },
        { price: 69.00 },
        { status: 'DRAFT' },
      ],
    },
    include: {
      shop: true,
      images: true,
    },
  });

  console.log('QUERY RESULTS:', JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
