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
  await prisma.blogPost.deleteMany({});
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

  const perfumeSeller = await prisma.user.create({
    data: {
      email: 'perfumeseller@seller.com',
      name: 'Aroma Palace Seller',
      role: Role.SELLER,
      phone: '+919876543210',
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

  // 3. Create Shop — Aroma Palace
  const aromaShop = await prisma.shop.create({
    data: {
      ownerId: perfumeSeller.id,
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
      isVerified: true,
    },
  });

  console.log('Shop created successfully.');

  // 4. Create Products — Aroma Palace Perfumes
  const p1 = await prisma.product.create({
    data: {
      shopId: aromaShop.id,
      title: 'Mystic Oud Eau de Parfum',
      slug: 'mystic-oud-eau-de-parfum',
      description: 'A deep oriental fragrance with agarwood, damask rose, and amber. Long-lasting sillage that commands attention in any room.',
      price: 2499,
      compareAtPrice: 2999,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: {
        create: [
          {
            url: '/uploads/perfumes/mystic_oud.png',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  const p2 = await prisma.product.create({
    data: {
      shopId: aromaShop.id,
      title: 'Velvet Rose Eau de Parfum',
      slug: 'velvet-rose-eau-de-parfum',
      description: 'A delicate floral blend of damask rose, geranium, and velvet musk. Perfect for romantic evenings and special occasions.',
      price: 1999,
      compareAtPrice: 2499,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: {
        create: [
          {
            url: '/uploads/perfumes/velvet_rose.png',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  const p3 = await prisma.product.create({
    data: {
      shopId: aromaShop.id,
      title: 'Citrus Breeze Eau de Parfum',
      slug: 'citrus-breeze-eau-de-parfum',
      description: 'A fresh zesty scent of Sicilian lemon, bergamot, and cedarwood. Ideal for everyday wear and warm-weather outings.',
      price: 1799,
      compareAtPrice: 2199,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: {
        create: [
          {
            url: '/uploads/perfumes/citrus_breeze.png',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  const p4 = await prisma.product.create({
    data: {
      shopId: aromaShop.id,
      title: 'Sandalwood Noir Eau de Parfum',
      slug: 'sandalwood-noir-eau-de-parfum',
      description: 'A warm woody fragrance of Mysore sandalwood, black pepper, and cardamom. A signature scent for the confident connoisseur.',
      price: 2299,
      compareAtPrice: 2799,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: {
        create: [
          {
            url: '/uploads/perfumes/sandalwood_noir.png',
            isPrimary: true,
            displayOrder: 0,
          },
        ],
      },
    },
  });

  console.log('Products created successfully.');

  // 5. Create a Review
  await prisma.review.create({
    data: {
      shopId: aromaShop.id,
      userId: buyer.id,
      rating: 5,
      comment: 'Absolutely love the Mystic Oud! The fragrance lasts all day and the packaging was premium. Will definitely order again.',
    },
  });

  console.log('Reviews created successfully.');

  // 6. Create Analytics (views & clicks)
  await prisma.analytics.createMany({
    data: [
      { shopId: aromaShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p1.id, createdAt: new Date() },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p2.id, createdAt: new Date() },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p3.id, createdAt: new Date() },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: p4.id, createdAt: new Date() },
      { shopId: aromaShop.id, eventType: AnalyticsEventType.WHATSAPP_CLICK, productId: p1.id, createdAt: new Date() },
    ],
  });

  console.log('Analytics created successfully.');

  // 7. Create Blog Posts
  await prisma.blogPost.createMany({
    data: [
      {
        slug: 'why-social-commerce-is-the-future',
        title: 'Why Social Commerce is the Future',
        excerpt: 'The way people buy and sell is shifting. Social commerce — where discovery, trust, and transactions happen through messaging apps — is growing faster than traditional e-commerce in emerging markets.',
        cover: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200',
        author: 'Seyon Team',
        category: 'Strategy',
        tags: ['STRATEGY', 'SOCIAL COMMERCE', 'BUSINESS'],
        readingTime: 3,
        featured: true,
        featuredProduct: 'mystic-oud-eau-de-parfum',
        seoTitle: 'Why Social Commerce is the Future — Seyon',
        seoDescription: 'The way people buy and sell is shifting. Social commerce — where discovery, trust, and transactions happen through messaging apps — is growing faster than traditional e-commerce in emerging markets.',
        seoKeywords: ['social commerce', 'strategy', 'future of sales', 'whatsapp storefront'],
        content: `Social commerce removes the friction of traditional online shopping. Instead of navigating checkout flows, entering card details, and waiting for confirmation emails, buyers simply message a seller directly on WhatsApp.

This model works because it mirrors how commerce has always worked in India — through relationships, conversation, and trust. A buyer asks questions, negotiates, and confirms an order in a single chat thread.

For sellers, social commerce means zero upfront costs. No website hosting fees, no payment gateway commissions, no inventory management software. Just a phone, a product, and a WhatsApp number.

[shop-the-story:mystic-oud-eau-de-parfum]

Seyon bridges the gap by giving these sellers a discoverable storefront while preserving the simplicity of direct messaging. It's the best of both worlds — the reach of e-commerce with the intimacy of local bazaar shopping.`,
      },
      {
        slug: 'setup-your-seyon-store-in-5-minutes',
        title: 'How to Set Up Your Seyon Store in 5 Minutes',
        excerpt: 'A step-by-step guide to creating your first storefront on Seyon — from sign-up to listing your first product.',
        cover: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=1200',
        author: 'Seyon Team',
        category: 'Guide',
        tags: ['GUIDE', 'TUTORIAL', 'SELLER SETTINGS'],
        readingTime: 4,
        featured: false,
        featuredProduct: 'velvet-rose-eau-de-parfum',
        seoTitle: 'Set Up Your Store in 5 Minutes — Seyon',
        seoDescription: 'A step-by-step guide to creating your first storefront on Seyon — from sign-up to listing your first product.',
        seoKeywords: ['setup store', 'selling guide', 'perfume store'],
        content: `Getting started on Seyon is designed to be fast and painless. Here's a quick walkthrough:

Step 1: Sign Up — Create a free seller account using your email or Google account. No approval process — your account is active immediately.

Step 2: Set Up Your Store — Choose a store name, write a short description, and upload your logo. This becomes your public storefront that buyers can browse.

[shop-the-story:velvet-rose-eau-de-parfum]

Step 3: Add Your WhatsApp Number — This is how buyers will reach you. When someone clicks "Chat to Buy", they'll be redirected to WhatsApp with a pre-filled message.

Step 4: List Your First Product — Add a title, description, price, category, and photos. Your product goes live instantly and becomes searchable on the Seyon marketplace.

Step 5: Share Your Store Link — Copy your unique store URL and share it on Instagram, WhatsApp Status, or any social platform. Every view is a potential customer.

That's it. Five minutes, zero cost, and you have a professional storefront ready to receive orders.`,
      },
      {
        slug: 'building-trust-with-buyers-online',
        title: 'Building Trust with Buyers Online',
        excerpt: 'Trust is the currency of social commerce. Learn how to build credibility, earn positive reviews, and increase your Trust Score on Seyon.',
        cover: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?q=80&w=1200',
        author: 'Seyon Team',
        category: 'Trust',
        tags: ['TRUST', 'REPUTATION', 'TIPS'],
        readingTime: 4,
        featured: false,
        featuredProduct: 'sandalwood-noir-eau-de-parfum',
        seoTitle: 'Building Trust Online — Seyon',
        seoDescription: 'Trust is the currency of social commerce. Learn how to build credibility, earn positive reviews, and increase your Trust Score on Seyon.',
        seoKeywords: ['building trust', 'seller reputation', 'positive reviews'],
        content: `When you're selling through messaging apps, trust is everything. Buyers can't physically examine your product, so they rely on signals — your store's reputation, product photos, reviews, and responsiveness.

Here's how to build trust on Seyon:

Use High-Quality Photos — Clear, well-lit product images are the single most important factor in earning buyer confidence. Show multiple angles and include size references.

Write Honest Descriptions — Don't oversell. Accurate descriptions lead to satisfied buyers, which leads to positive reviews. Mention materials, dimensions, and any imperfections.

[shop-the-story:sandalwood-noir-eau-de-parfum]

Respond Quickly — When a buyer messages you on WhatsApp, respond within minutes if possible. Fast replies signal professionalism and reliability.

Encourage Reviews — After a successful sale, ask your buyer to leave a review on Seyon. Reviews directly impact your Trust Score and search ranking.

Be Transparent About Shipping — Set clear expectations about delivery timelines, shipping costs, and return policies upfront. Surprises erode trust.

Your Trust Score on Seyon reflects all of these factors. A higher score means better visibility in search results and more buyers reaching out to you.`,
      },
    ],
  });

  console.log('Blog posts created successfully.');
  console.log('Seeding complete! Only Aroma Palace perfume store seeded.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
