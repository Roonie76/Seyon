import { db } from './src/backend/lib/db';

async function main() {
  const shops = await db.shop.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('SHOPS IN DATABASE:', JSON.stringify(shops, null, 2));
}

main().catch(console.error);
