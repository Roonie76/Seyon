import { db } from '../src/backend/lib/db';

async function main() {
  console.log('Activating "Goated horse" and "Ring Box"...');
  
  const updated1 = await db.product.updateMany({
    where: {
      title: 'Goated horse',
      status: 'DRAFT'
    },
    data: {
      status: 'ACTIVE'
    }
  });
  console.log(`Updated Goated horse status to ACTIVE. Count: ${updated1.count}`);

  const updated2 = await db.product.updateMany({
    where: {
      title: 'Ring Box',
      price: 1.00,
      status: 'DRAFT'
    },
    data: {
      status: 'ACTIVE'
    }
  });
  console.log(`Updated Ring Box status to ACTIVE. Count: ${updated2.count}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
