import { db } from '../src/backend/lib/db';

async function main() {
  console.log('Searching database for shop "blingzbae"...');
  
  const shops = await db.shop.findMany({
    where: {
      OR: [
        { name: { contains: 'blingzbae', mode: 'insensitive' } },
        { slug: { contains: 'blingzbae', mode: 'insensitive' } },
        { name: { contains: 'blingz', mode: 'insensitive' } },
        { slug: { contains: 'blingz', mode: 'insensitive' } },
      ],
    },
    include: {
      owner: true,
      products: true,
    },
  });

  console.log('FOUND SHOPS:', JSON.stringify(shops, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
