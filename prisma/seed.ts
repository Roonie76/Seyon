import 'dotenv/config';
import { Role, ProductStatus, ReportStatus, AnalyticsEventType } from '@prisma/client';
import { db as prisma } from '../src/backend/lib/db';

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing records
  await prisma.analytics.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.shop.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Users
  await prisma.user.create({
    data: {
      email: 'admin@seyon.com',
      name: 'Seyon Admin',
      role: Role.ADMIN,
      phone: '+1234567890',
    },
  });

  const seller1 = await prisma.user.create({
    data: {
      email: 'gadgets@seller.com',
      name: 'John Doe (Gadgets)',
      role: Role.SELLER,
      phone: '+15550100200',
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      email: 'vogue@seller.com',
      name: 'Jane Smith (Vogue)',
      role: Role.SELLER,
      phone: '+15550300400',
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: 'buyer@customer.com',
      name: 'Regular Customer',
      role: Role.USER,
      phone: '+15550500600',
    },
  });

  console.log('Users created successfully.');

  // 3. Create Shops
  const gadgetShop = await prisma.shop.create({
    data: {
      ownerId: seller1.id,
      name: 'Gadget Central',
      slug: 'gadget-central',
      description: 'Your premium hub for all things tech, from smartphones to vintage mechanical keyboards.',
      logo: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&h=150&q=80',
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=400&q=80',
      whatsapp: '15550100200',
      instagram: 'gadgetcentral_ig',
      telegram: 'gadgetcentral_tg',
      isVerified: true,
    },
  });

  const fashionShop = await prisma.shop.create({
    data: {
      ownerId: seller2.id,
      name: 'Vogue Boutique',
      slug: 'vogue-boutique',
      description: 'Handcrafted sustainable streetwear, tailored to express your authentic aesthetic.',
      logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&h=150&q=80',
      banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&h=400&q=80',
      whatsapp: '15550300400',
      instagram: 'vogue_boutique',
      telegram: 'vogue_boutique_tg',
      isVerified: false,
    },
  });

  console.log('Shops created successfully.');

  // 4. Create Products and Product Images
  // Gadget Central Products
  const p1 = await prisma.product.create({
    data: {
      shopId: gadgetShop.id,
      title: 'Mechanical Keychron K2 Keyboard',
      slug: 'mechanical-keychron-k2-keyboard',
      description: 'Tactile blue switches, elegant RGB backlit frame, double-shot keycaps, and full Mac/Windows support. Barely used.',
      price: 89.99,
      category: 'Electronics',
      status: ProductStatus.ACTIVE,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: true,
            displayOrder: 0,
          },
          {
            url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: false,
            displayOrder: 1,
          },
        ],
      },
    },
  });

  const p2 = await prisma.product.create({
    data: {
      shopId: gadgetShop.id,
      title: 'Sony WH-1000XM4 Noise Canceling Headphones',
      slug: 'sony-wh1000xm4-headphones',
      description: 'Industry-leading noise cancellation, 30 hours battery life, touch control sensors, and premium microphone quality.',
      price: 249.50,
      category: 'Electronics',
      status: ProductStatus.ACTIVE,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      shopId: gadgetShop.id,
      title: 'Draft Item USB Hub',
      slug: 'draft-item-usb-hub',
      description: 'Not ready for listing yet.',
      price: 15.00,
      category: 'Electronics',
      status: ProductStatus.DRAFT,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  // Vogue Boutique Products
  const p4 = await prisma.product.create({
    data: {
      shopId: fashionShop.id,
      title: 'Oversized Vintage Leather Jacket',
      slug: 'oversized-vintage-leather-jacket',
      description: 'Thick genuine cowhide leather jacket, distressed edges, full lining, vintage heavy metal zippers. True unisex style.',
      price: 135.00,
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      shopId: fashionShop.id,
      title: 'Beige Canvas Totebag',
      slug: 'beige-canvas-totebag',
      description: 'Minimalist aesthetic canvas totebag with dual interior pockets. Perfectly fits a 15-inch laptop and your books.',
      price: 19.99,
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&h=450&q=80',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  console.log('Products and Product Images created successfully.');

  // 5. Create Reviews
  await prisma.review.create({
    data: {
      shopId: gadgetShop.id,
      userId: buyer.id,
      rating: 5,
      comment: 'Super fast communication and high-quality mechanical keyboard as described. A+ seller!',
    },
  });

  await prisma.review.create({
    data: {
      shopId: fashionShop.id,
      userId: buyer.id,
      rating: 4,
      comment: 'Excellent leather jacket, feels heavy and durable. Seller took 1 day to answer my WhatsApp though.',
    },
  });

  console.log('Reviews created successfully.');

  // 6. Create Reports
  await prisma.report.create({
    data: {
      shopId: fashionShop.id,
      userId: buyer.id,
      reason: 'Seller has listed an item that is out of stock but listed as active.',
      status: ReportStatus.OPEN,
    },
  });

  console.log('Reports created successfully.');

  // 7. Create Analytics (views & clicks)
  // Gadget Central analytics
  await prisma.analytics.createMany({
    data: [
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p1.id, createdAt: new Date() },
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p2.id, createdAt: new Date() },
      { shopId: gadgetShop.id, eventType: AnalyticsEventType.WHATSAPP_CLICK, productId: p1.id, createdAt: new Date() },
    ],
  });

  // Vogue Boutique analytics
  await prisma.analytics.createMany({
    data: [
      { shopId: fashionShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { shopId: fashionShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p4.id, createdAt: new Date() },
      { shopId: fashionShop.id, eventType: AnalyticsEventType.WHATSAPP_CLICK, productId: p4.id, createdAt: new Date() },
    ],
  });

  console.log('Analytics created successfully.');
  console.log('Seeding complete! Ready for local development.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
