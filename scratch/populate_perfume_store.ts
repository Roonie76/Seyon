import { db } from '../src/backend/lib/db';
import { Role, ProductStatus } from '@prisma/client';

async function main() {
  console.log('Cleaning up existing perfume simulation data...');
  
  // 1. Clean up old user, shop, and products if they exist
  const existingEmails = ['perfumeseller@seller.com', 'perfumelover@seller.com'];
  for (const email of existingEmails) {
    const oldUser = await db.user.findUnique({
      where: { email },
      include: { shop: true },
    });
    if (oldUser) {
      if (oldUser.shop) {
        await db.product.deleteMany({ where: { shopId: oldUser.shop.id } });
        await db.shop.delete({ where: { id: oldUser.shop.id } });
      }
      await db.user.delete({ where: { id: oldUser.id } });
      console.log(`Deleted existing user and shop for: ${email}`);
    }
  }

  console.log('Creating Aroma Palace seller, storefront, and products...');

  // 2. Create seller user
  const user = await db.user.create({
    data: {
      email: 'perfumeseller@seller.com',
      name: 'Aroma Palace Seller',
      role: Role.SELLER,
      phone: '+919876543210',
    },
  });

  // 3. Create shop
  const shop = await db.shop.create({
    data: {
      ownerId: user.id,
      name: 'Aroma Palace',
      slug: 'aroma-palace',
      description: 'Premium hand-crafted perfumes and luxury room fragrances.',
      logo: '/uploads/perfumes/mystic_oud.png',
      banner: '/uploads/perfumes/sandalwood_noir.png',
      whatsapp: '919876543210',
      instagram: 'aroma_palace',
      telegram: 'aroma_palace_tg',
      city: 'Mumbai',
      region: 'Maharashtra',
      deliveryNote: 'Free shipping; Premium packaging; Ships in 48h',
      isVerified: false,
    },
  });

  // 4. Create products
  const products = [
    {
      title: 'Mystic Oud Eau de Parfum',
      slug: 'mystic-oud-eau-de-parfum',
      description: 'A deep oriental fragrance with agarwood, damask rose, and amber.',
      price: 2499,
      compareAtPrice: 2999,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      imageUrl: '/uploads/perfumes/mystic_oud.png',
    },
    {
      title: 'Velvet Rose Eau de Parfum',
      slug: 'velvet-rose-eau-de-parfum',
      description: 'A delicate floral blend of damask rose, geranium, and velvet musk.',
      price: 1999,
      compareAtPrice: 2499,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      imageUrl: '/uploads/perfumes/velvet_rose.png',
    },
    {
      title: 'Citrus Breeze Eau de Parfum',
      slug: 'citrus-breeze-eau-de-parfum',
      description: 'A fresh zesty scent of Sicilian lemon, bergamot, and cedarwood.',
      price: 1799,
      compareAtPrice: 2199,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      imageUrl: '/uploads/perfumes/citrus_breeze.png',
    },
    {
      title: 'Sandalwood Noir Eau de Parfum',
      slug: 'sandalwood-noir-eau-de-parfum',
      description: 'A warm woody fragrance of Mysore sandalwood, black pepper, and cardamom.',
      price: 2299,
      compareAtPrice: 2799,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      imageUrl: '/uploads/perfumes/sandalwood_noir.png',
    },
  ];

  for (const prod of products) {
    const product = await db.product.create({
      data: {
        shopId: shop.id,
        title: prod.title,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        options: prod.options,
        category: prod.category,
        status: ProductStatus.ACTIVE,
        inStock: true,
        images: {
          create: [
            {
              url: prod.imageUrl,
              isPrimary: true,
              displayOrder: 0,
            },
          ],
        },
      },
    });
    console.log(`Created product: ${product.title}`);
  }

  console.log('Verification: All items created successfully!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
