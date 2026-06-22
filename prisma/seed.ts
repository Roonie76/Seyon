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

  const seller3 = await prisma.user.create({
    data: {
      email: 'pasteldreams@seller.com',
      name: 'Pastel Dreams Owner',
      role: Role.SELLER,
      phone: '+15550200300',
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
      isVerified: true,
    },
  });

  const pastelShop = await prisma.shop.create({
    data: {
      ownerId: seller3.id,
      name: 'Pastel Dreams',
      slug: 'pasteldreams',
      description: 'A beautiful boutique of pastel crafts and jewelry.',
      logo: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=150&h=150&q=80',
      banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&h=400&q=80',
      whatsapp: '15550200300',
      instagram: 'pasteldreams_ig',
      telegram: 'pasteldreams_tg',
      isVerified: true,
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

  // Pastel Dreams Products
  await prisma.product.create({
    data: {
      shopId: pastelShop.id,
      title: 'Pastel Rose Ring Box',
      slug: 'ring-box',
      description: 'An elegant, handmade velvet ring box in soft pastel shades.',
      price: 25.00,
      category: 'Art & Craft',
      status: ProductStatus.ACTIVE,
      images: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&h=450&q=80',
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

  // 8. Create Blog Posts
  await prisma.blogPost.deleteMany({});
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
        featuredProduct: 'sony-wh1000xm4-headphones',
        seoTitle: 'Why Social Commerce is the Future — Seyon',
        seoDescription: 'The way people buy and sell is shifting. Social commerce — where discovery, trust, and transactions happen through messaging apps — is growing faster than traditional e-commerce in emerging markets.',
        seoKeywords: ['social commerce', 'strategy', 'future of sales', 'whatsapp storefront'],
        content: `Social commerce removes the friction of traditional online shopping. Instead of navigating checkout flows, entering card details, and waiting for confirmation emails, buyers simply message a seller directly on WhatsApp.

This model works because it mirrors how commerce has always worked in India — through relationships, conversation, and trust. A buyer asks questions, negotiates, and confirms an order in a single chat thread.

For sellers, social commerce means zero upfront costs. No website hosting fees, no payment gateway commissions, no inventory management software. Just a phone, a product, and a WhatsApp number.

[shop-the-story:sony-wh1000xm4-headphones]

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
        featuredProduct: 'beige-canvas-totebag',
        seoTitle: 'Set Up Your Store in 5 Minutes — Seyon',
        seoDescription: 'A step-by-step guide to creating your first storefront on Seyon — from sign-up to listing your first product.',
        seoKeywords: ['setup store', 'selling guide', 'canvas totebag'],
        content: `Getting started on Seyon is designed to be fast and painless. Here's a quick walkthrough:

Step 1: Sign Up — Create a free seller account using your email or Google account. No approval process — your account is active immediately.

Step 2: Set Up Your Store — Choose a store name, write a short description, and upload your logo. This becomes your public storefront that buyers can browse.

[shop-the-story:beige-canvas-totebag]

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
        featuredProduct: 'mechanical-keychron-k2-keyboard',
        seoTitle: 'Building Trust Online — Seyon',
        seoDescription: 'Trust is the currency of social commerce. Learn how to build credibility, earn positive reviews, and increase your Trust Score on Seyon.',
        seoKeywords: ['building trust', 'seller reputation', 'positive reviews'],
        content: `When you're selling through messaging apps, trust is everything. Buyers can't physically examine your product, so they rely on signals — your store's reputation, product photos, reviews, and responsiveness.

Here's how to build trust on Seyon:

Use High-Quality Photos — Clear, well-lit product images are the single most important factor in earning buyer confidence. Show multiple angles and include size references.

Write Honest Descriptions — Don't oversell. Accurate descriptions lead to satisfied buyers, which leads to positive reviews. Mention materials, dimensions, and any imperfections.

[shop-the-story:mechanical-keychron-k2-keyboard]

Respond Quickly — When a buyer messages you on WhatsApp, respond within minutes if possible. Fast replies signal professionalism and reliability.

Encourage Reviews — After a successful sale, ask your buyer to leave a review on Seyon. Reviews directly impact your Trust Score and search ranking.

Be Transparent About Shipping — Set clear expectations about delivery timelines, shipping costs, and return policies upfront. Surprises erode trust.

Your Trust Score on Seyon reflects all of these factors. A higher score means better visibility in search results and more buyers reaching out to you.`,
      },
    ],
  });

  console.log('Blog posts created successfully.');
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
