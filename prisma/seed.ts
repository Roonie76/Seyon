import 'dotenv/config';
import { Role, ProductStatus, ReportStatus, AnalyticsEventType } from '@prisma/client';
import { db as prisma } from '../src/backend/lib/db';

/**
 * This script TRUNCATES every table before seeding. It must never be able to
 * run against a hosted database by accident — `prisma migrate reset`, an IDE
 * "run seed" button, or a stale DATABASE_URL are all one keystroke away.
 *
 * The target must either be a local database, or the operator must name it
 * explicitly:  SEED_CONFIRM=<database name> npx prisma db seed
 */
function assertSafeSeedTarget(): void {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('Refusing to seed: no DATABASE_URL is set.');

  let host = '';
  let database = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('Refusing to seed: DATABASE_URL is not a valid connection string.');
  }

  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'host.docker.internal' ||
    host === 'db' ||
    host === 'postgres';

  if (isLocal) return;

  if (process.env.SEED_CONFIRM && process.env.SEED_CONFIRM === database) {
    console.warn(
      `\n⚠  Seeding NON-LOCAL database "${database}" on ${host} — every table will be wiped.\n`
    );
    return;
  }

  throw new Error(
    `Refusing to seed a non-local database.\n` +
      `  host:     ${host}\n` +
      `  database: ${database}\n\n` +
      `This script deletes every User, Shop, Product, Review, Report and Analytics row.\n` +
      `Point DATABASE_URL at your local Postgres (see docker-compose.yml), or, if you\n` +
      `really mean it, re-run with SEED_CONFIRM=${database}.`
  );
}

async function main() {
  assertSafeSeedTarget();
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
  console.log('Creating users...');
  
  // Admin & Buyer
  await prisma.user.create({
    data: {
      email: 'admin@seyon.com',
      name: 'Seyon Admin',
      role: Role.ADMIN,
      phone: '+1234567890',
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

  // Seller Users
  const uAroma = await prisma.user.create({
    data: { email: 'perfumeseller@seller.com', name: 'Aroma Palace Seller', role: Role.SELLER, phone: '+919876543210' },
  });
  
  const uCrafted = await prisma.user.create({
    data: { email: 'crafted_dreams@seller.com', name: 'Crafted Dreams Seller', role: Role.SELLER, phone: '+919876543211' },
  });

  const uSilver = await prisma.user.create({
    data: { email: 'silver_stories@seller.com', name: 'Silver Stories Seller', role: Role.SELLER, phone: '+919876543212' },
  });

  const uClay = await prisma.user.create({
    data: { email: 'clay_house@seller.com', name: 'Clay House Seller', role: Role.SELLER, phone: '+919876543213' },
  });

  const uPrint = await prisma.user.create({
    data: { email: 'print_paint@seller.com', name: 'Print & Paint Seller', role: Role.SELLER, phone: '+919876543214' },
  });

  const uThreaded = await prisma.user.create({
    data: { email: 'threaded_tales@seller.com', name: 'Threaded Tales Seller', role: Role.SELLER, phone: '+919876543215' },
  });

  const uSketch = await prisma.user.create({
    data: { email: 'the_sketch_space@seller.com', name: 'The Sketch Space Seller', role: Role.SELLER, phone: '+919876543216' },
  });

  const uBrew = await prisma.user.create({
    data: { email: 'brew_candle@seller.com', name: 'Brew & Candle Seller', role: Role.SELLER, phone: '+919876543217' },
  });

  const uEarthy = await prisma.user.create({
    data: { email: 'earthy_bowls@seller.com', name: 'Earthy Bowls Seller', role: Role.SELLER, phone: '+919876543218' },
  });

  const uIndigo = await prisma.user.create({
    data: { email: 'indigo_indigo@seller.com', name: 'Indigo Indigo Seller', role: Role.SELLER, phone: '+919876543219' },
  });

  console.log('Users created successfully.');

  // 3. Create Shops
  console.log('Creating shops...');
  
  // Shop 1: Aroma Palace (Beauty, Mumbai)
  const shopAroma = await prisma.shop.create({
    data: {
      ownerId: uAroma.id,
      name: 'Aroma Palace',
      slug: 'aroma-palace',
      description: 'Premium hand-crafted perfumes and luxury room fragrances.',
      logo: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=600',
      banner: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=600',
      whatsapp: '919876543210',
      instagram: 'aroma_palace',
      telegram: 'aroma_palace_tg',
      city: 'Mumbai',
      region: 'Maharashtra',
      deliveryNote: 'Free shipping; Premium packaging; Ships in 48h',
      isVerified: true,
      isListed: true,
      averageRating: 4.9,
      reviewCount: 48,
    },
  });

  // Shop 2: Crafted Dreams (Home & Living, Jaipur)
  const shopCrafted = await prisma.shop.create({
    data: {
      ownerId: uCrafted.id,
      name: 'Crafted Dreams',
      slug: 'crafted-dreams',
      description: 'Beautiful handmade home decor, crochet accessories, and macrame wall art.',
      logo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1200',
      whatsapp: '919876543211',
      instagram: 'crafted_dreams',
      city: 'Jaipur',
      region: 'Rajasthan',
      deliveryNote: 'Free shipping on orders above ₹999; Handcrafted with love',
      isVerified: true,
      isListed: true,
      averageRating: 4.8,
      reviewCount: 32,
    },
  });

  // Shop 3: Silver Stories (Fashion, Delhi)
  const shopSilver = await prisma.shop.create({
    data: {
      ownerId: uSilver.id,
      name: 'Silver Stories',
      slug: 'silver-stories',
      description: 'Exquisite 925 sterling silver jewelry handcrafted by traditional artisans.',
      logo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=1200',
      whatsapp: '919876543212',
      instagram: 'silver_stories',
      city: 'Delhi',
      region: 'Delhi',
      deliveryNote: 'Certified 925 Silver; Premium velvet pouch included',
      isVerified: true,
      isListed: true,
      averageRating: 4.7,
      reviewCount: 29,
    },
  });

  // Shop 4: Clay House (Home & Living, Kochi)
  const shopClay = await prisma.shop.create({
    data: {
      ownerId: uClay.id,
      name: 'Clay House',
      slug: 'clay-house',
      description: 'Contemporary ceramic pottery, planters, and tableware for modern spaces.',
      logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1565192647048-f997ded87ab5?q=80&w=1200',
      whatsapp: '919876543213',
      instagram: 'clay_house',
      city: 'Kochi',
      region: 'Kerala',
      deliveryNote: 'Safe double-box packaging; Eco-friendly clay materials',
      isVerified: true,
      isListed: true,
      averageRating: 4.9,
      reviewCount: 41,
    },
  });

  // Shop 5: Print & Paint (Art, Bangalore)
  const shopPrint = await prisma.shop.create({
    data: {
      ownerId: uPrint.id,
      name: 'Print & Paint',
      slug: 'print-paint',
      description: 'Aesthetic prints, posters, and hand-poured soy candles for your creative corner.',
      logo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1200',
      whatsapp: '919876543214',
      instagram: 'print_paint',
      city: 'Bangalore',
      region: 'Karnataka',
      deliveryNote: 'Rigid tube packing for prints; Gift wrapping available',
      isVerified: true,
      isListed: true,
      averageRating: 4.6,
      reviewCount: 18,
    },
  });

  // Shop 6: Threaded Tales (Fashion, Mumbai) - New Creator
  const shopThreaded = await prisma.shop.create({
    data: {
      ownerId: uThreaded.id,
      name: 'Threaded Tales',
      slug: 'threaded-tales',
      description: 'Sustainable hand-woven cotton bags, crochet totes, and boho accessories.',
      logo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1200',
      whatsapp: '919876543215',
      instagram: 'threaded_tales',
      city: 'Mumbai',
      region: 'Maharashtra',
      deliveryNote: '100% biodegradable materials; Hand-knit on order',
      isVerified: false,
      isListed: true,
      averageRating: 4.5,
      reviewCount: 14,
    },
  });

  // Shop 7: The Sketch Space (Art, Pune) - New Creator
  const shopSketch = await prisma.shop.create({
    data: {
      ownerId: uSketch.id,
      name: 'The Sketch Space',
      slug: 'the-sketch-space',
      description: 'Hand-drawn illustrations, customized portraits, and minimalist stationery.',
      logo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1200',
      whatsapp: '919876543216',
      instagram: 'the_sketch_space',
      city: 'Pune',
      region: 'Maharashtra',
      deliveryNote: 'Ships in sturdy cardboard envelope; Custom commissions open',
      isVerified: false,
      isListed: true,
      averageRating: 4.8,
      reviewCount: 12,
    },
  });

  // Shop 8: Brew & Candle (Home & Living, Chennai) - New Creator
  const shopBrew = await prisma.shop.create({
    data: {
      ownerId: uBrew.id,
      name: 'Brew & Candle',
      slug: 'brew-and-candle',
      description: 'Artisanal coffee-scented wax candles and handmade ceramic brew-cups.',
      logo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200',
      whatsapp: '919876543217',
      instagram: 'brew_candle',
      city: 'Chennai',
      region: 'Tamil Nadu',
      deliveryNote: 'Made with organic soy wax and coffee extracts',
      isVerified: false,
      isListed: true,
      averageRating: 4.6,
      reviewCount: 8,
    },
  });

  // Shop 9: Earthy Bowls (Home & Living, Goa) - New Creator
  const shopEarthy = await prisma.shop.create({
    data: {
      ownerId: uEarthy.id,
      name: 'Earthy Bowls',
      slug: 'earthy-bowls',
      description: 'Handcrafted coconut shell bowls, bamboo cutlery, and zero-waste dining essentials.',
      logo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1200',
      whatsapp: '919876543218',
      instagram: 'earthy_bowls',
      city: 'Goa',
      region: 'Goa',
      deliveryNote: '100% natural, polished with pure coconut oil',
      isVerified: false,
      isListed: true,
      averageRating: 4.7,
      reviewCount: 15,
    },
  });

  // Shop 10: Indigo Indigo (Fashion, Kolkata) - New Creator
  const shopIndigo = await prisma.shop.create({
    data: {
      ownerId: uIndigo.id,
      name: 'Indigo Indigo',
      slug: 'indigo-indigo',
      description: 'Traditional block-printed indigo apparel and hand-dyed scarves.',
      logo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&h=200&fit=crop',
      banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200',
      whatsapp: '919876543219',
      instagram: 'indigo_indigo',
      city: 'Kolkata',
      region: 'West Bengal',
      deliveryNote: 'Authentic Dabu block prints; Hand-wash recommended',
      isVerified: false,
      isListed: true,
      averageRating: 4.4,
      reviewCount: 9,
    },
  });

  console.log('Shops created successfully.');

  // 4. Create Products
  console.log('Creating products...');
  const productsList = [];

  // Aroma Palace Products
  const ap1 = await prisma.product.create({
    data: {
      shopId: shopAroma.id,
      title: 'Mystic Oud Eau de Parfum',
      slug: 'mystic-oud-eau-de-parfum',
      description: 'A deep oriental fragrance with agarwood, damask rose, and amber. Long-lasting sillage that commands attention in any room.',
      price: 2499,
      compareAtPrice: 2999,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ap1);

  const ap2 = await prisma.product.create({
    data: {
      shopId: shopAroma.id,
      title: 'Velvet Rose Eau de Parfum',
      slug: 'velvet-rose-eau-de-parfum',
      description: 'A delicate floral blend of damask rose, geranium, and velvet musk. Perfect for romantic evenings and special occasions.',
      price: 1999,
      compareAtPrice: 2499,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ap2);

  const ap3 = await prisma.product.create({
    data: {
      shopId: shopAroma.id,
      title: 'Citrus Breeze Eau de Parfum',
      slug: 'citrus-breeze-eau-de-parfum',
      description: 'A fresh zesty scent of Sicilian lemon, bergamot, and cedarwood. Ideal for everyday wear and warm-weather outings.',
      price: 1799,
      compareAtPrice: 2199,
      options: 'Size: 50ml, 100ml',
      category: 'Beauty',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ap3);

  // Crafted Dreams Products
  const cd1 = await prisma.product.create({
    data: {
      shopId: shopCrafted.id,
      title: 'Minimalist Ceramic Mug',
      slug: 'minimalist-ceramic-mug',
      description: 'An elegant, organically-shaped ceramic mug with a speckled cream glaze. Fits perfectly in the palm of your hand.',
      price: 899,
      compareAtPrice: 1199,
      options: 'Color: Cream, Terracotta, Sage',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(cd1);

  const cd2 = await prisma.product.create({
    data: {
      shopId: shopCrafted.id,
      title: 'Handmade Crochet Bag',
      slug: 'handmade-crochet-bag',
      description: 'Chic woven cotton shoulder bag, beautifully patterned and perfect for summer outings or beach days.',
      price: 1599,
      compareAtPrice: 1999,
      options: 'Color: Beige, Olive, Mustard',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1622560480654-d96214fdc887?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(cd2);

  const cd3 = await prisma.product.create({
    data: {
      shopId: shopCrafted.id,
      title: 'Macrame Wall Hanging',
      slug: 'macrame-wall-hanging',
      description: 'Intricately knotted cotton rope tapestry hung on a natural driftwood stick. Adds cozy bohemian texture to any room.',
      price: 1299,
      compareAtPrice: 1699,
      options: 'Size: Standard (24"x30")',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(cd3);

  // Silver Stories Products
  const ss1 = await prisma.product.create({
    data: {
      shopId: shopSilver.id,
      title: '925 Silver Anklet with Charms',
      slug: '925-silver-anklet-with-charms',
      description: 'Elegant sterling silver anklet decorated with tiny bell charms. Gives a soft musical chime with every step.',
      price: 1899,
      compareAtPrice: 2499,
      options: 'Length: 9 inch, 10 inch',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ss1);

  const ss2 = await prisma.product.create({
    data: {
      shopId: shopSilver.id,
      title: 'Silver Nose Ring Set',
      slug: 'silver-nose-ring-set',
      description: 'A set of three delicate, non-piercing sterling silver nose rings with traditional intricate wirework.',
      price: 699,
      compareAtPrice: 899,
      options: 'Design: Classic Tri-pack',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ss2);

  const ss3 = await prisma.product.create({
    data: {
      shopId: shopSilver.id,
      title: 'Oxidized Jhumkas',
      slug: 'oxidized-jhumkas',
      description: 'Statement tribal-style oxidized silver earrings featuring delicate floral motifs and hanging beads.',
      price: 999,
      compareAtPrice: 1299,
      options: 'Size: Medium, Large',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1635767790028-3e1a216d89fc?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ss3);

  // Clay House Products
  const ch1 = await prisma.product.create({
    data: {
      shopId: shopClay.id,
      title: 'Abstract Art Print No. 07',
      slug: 'abstract-art-print-no-07',
      description: 'A minimalist earthy abstract print in warm shades of terracotta, ochre, and sand. Printed on archival cotton paper.',
      price: 799,
      compareAtPrice: 1099,
      options: 'Size: A4, A3',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ch1);

  const ch2 = await prisma.product.create({
    data: {
      shopId: shopClay.id,
      title: 'Ceramic Planter Set',
      slug: 'ceramic-planter-set',
      description: 'Set of two hand-thrown stoneware planters with drainage holes and matching trays. Features a beautiful raw clay base.',
      price: 1499,
      compareAtPrice: 1999,
      options: 'Glaze: Moss Green, Stormy Blue',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ch2);

  const ch3 = await prisma.product.create({
    data: {
      shopId: shopClay.id,
      title: 'Terra Cotta Vase',
      slug: 'terra-cotta-vase',
      description: 'Classic rustic terracotta clay vase, hand-shaped by village potters. Beautiful with dried pampas grass or single stems.',
      price: 1199,
      compareAtPrice: 1499,
      options: 'Size: 8-inch, 12-inch',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ch3);

  // Print & Paint Products
  const pp1 = await prisma.product.create({
    data: {
      shopId: shopPrint.id,
      title: 'Aesthetic Soy Candle',
      slug: 'aesthetic-soy-candle',
      description: 'Hand-poured candle in a beautiful rib-textured glass jar. Scented with calming lavender and warm vanilla essential oils.',
      price: 599,
      compareAtPrice: 799,
      options: 'Scent: Lavender-Vanilla, Cedarwood-Sandalwood',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(pp1);

  const pp2 = await prisma.product.create({
    data: {
      shopId: shopPrint.id,
      title: 'Vanilla Soy Candle Trio',
      slug: 'vanilla-soy-candle-trio',
      description: 'Set of three small amber glass jar candles with wood wicks. Delightful sweet vanilla and spice fragrance.',
      price: 1299,
      compareAtPrice: 1599,
      options: 'Wick: Crackling Wood Wick',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1508747703725-719ae257c84a?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(pp2);

  const pp3 = await prisma.product.create({
    data: {
      shopId: shopPrint.id,
      title: 'Botanical Print Set',
      slug: 'botanical-print-set',
      description: 'Set of three high-quality prints featuring vintage hand-painted leaf and fern illustrations on a textured cream background.',
      price: 899,
      compareAtPrice: 1199,
      options: 'Size: 8x10 inches',
      category: 'Art & Collectibles',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(pp3);

  // Threaded Tales Products
  const tt1 = await prisma.product.create({
    data: {
      shopId: shopThreaded.id,
      title: 'Crochet Tote Bag',
      slug: 'crochet-tote-bag',
      description: 'Durable, hand-knitted cotton mesh tote. Perfect for carrying books, groceries, or daily essentials with style.',
      price: 1499,
      compareAtPrice: 1899,
      options: 'Color: Forest Green, Mustard, Terracotta',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(tt1);

  const tt2 = await prisma.product.create({
    data: {
      shopId: shopThreaded.id,
      title: 'Cotton Market Bag',
      slug: 'cotton-market-bag',
      description: 'Eco-friendly collapsible net market bag made of heavy-duty organic cotton. Expandable and extremely sturdy.',
      price: 799,
      compareAtPrice: 999,
      options: 'Color: Off-White, Sage, Rust',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(tt2);

  const tt3 = await prisma.product.create({
    data: {
      shopId: shopThreaded.id,
      title: 'Boho Macrame Bag',
      slug: 'boho-macrame-bag',
      description: 'Gorgeously fringed macrame shoulder bag with a secure fabric lining and a zip closure inside.',
      price: 1699,
      compareAtPrice: 2199,
      options: 'Color: Natural Cream, Midnight Black',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(tt3);

  // The Sketch Space Products
  const sk1 = await prisma.product.create({
    data: {
      shopId: shopSketch.id,
      title: 'Custom Line Portrait',
      slug: 'custom-line-portrait',
      description: 'A beautiful, minimalist hand-drawn digital line illustration based on your favorite photo. Sent as a premium card print.',
      price: 1199,
      compareAtPrice: 1599,
      options: 'Format: Digital + A5 Print',
      category: 'Art & Collectibles',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(sk1);

  // Brew & Candle Products
  const bc1 = await prisma.product.create({
    data: {
      shopId: shopBrew.id,
      title: 'Mocha Espresso Soy Candle',
      slug: 'mocha-espresso-soy-candle',
      description: 'Rich, bold aroma of freshly brewed espresso beans, sweet chocolate, and warm vanilla cream. Poured in a ceramic espresso cup.',
      price: 649,
      compareAtPrice: 799,
      options: 'Size: 150g',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(bc1);

  // Earthy Bowls Products
  const eb1 = await prisma.product.create({
    data: {
      shopId: shopEarthy.id,
      title: 'Coconut Shell Bowl Set',
      slug: 'coconut-shell-bowl-set',
      description: 'Set of two natural coconut bowls polished with pure coconut oil, complete with two wooden spoons. Perfect for smoothie bowls.',
      price: 749,
      compareAtPrice: 999,
      options: 'Set: 2 Bowls + 2 Spoons',
      category: 'Home & Living',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(eb1);

  // Indigo Indigo Products
  const ii1 = await prisma.product.create({
    data: {
      shopId: shopIndigo.id,
      title: 'Hand-Dyed Indigo Scarf',
      slug: 'hand-dyed-indigo-scarf',
      description: 'Lightweight mulmul cotton scarf dyed in natural indigo using traditional Shibori tie-dye techniques. Unique patterns on every piece.',
      price: 699,
      compareAtPrice: 899,
      options: 'Color: Indigo Blue & White',
      category: 'Fashion',
      status: ProductStatus.ACTIVE,
      inStock: true,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=600', isPrimary: true, displayOrder: 0 }] },
    },
  });
  productsList.push(ii1);

  console.log('Products created successfully.');

  // 5. Create Reviews
  console.log('Creating reviews...');
  await prisma.review.create({
    data: {
      shopId: shopAroma.id,
      userId: buyer.id,
      rating: 5,
      comment: 'Absolutely love the Mystic Oud! The fragrance lasts all day and the packaging was premium. Will definitely order again.',
    },
  });

  await prisma.review.create({
    data: {
      shopId: shopCrafted.id,
      userId: buyer.id,
      rating: 5,
      comment: 'The ceramic mug is so beautiful and comfortable to hold. Highly recommend Crafted Dreams!',
    },
  });

  await prisma.review.create({
    data: {
      shopId: shopClay.id,
      userId: buyer.id,
      rating: 4,
      comment: 'Very lovely ceramic planters. One had a very tiny scratch, but the packing was otherwise stellar.',
    },
  });

  console.log('Reviews created successfully.');

  // 6. Create Analytics (views & clicks)
  console.log('Creating analytics...');
  await prisma.analytics.createMany({
    data: [
      { shopId: shopAroma.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { shopId: shopAroma.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { shopId: shopCrafted.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { shopId: shopSilver.id, eventType: AnalyticsEventType.SHOP_VIEW, createdAt: new Date() },
      { shopId: shopAroma.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: ap1.id, createdAt: new Date() },
      { shopId: shopAroma.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: ap2.id, createdAt: new Date() },
      { shopId: shopCrafted.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: cd1.id, createdAt: new Date() },
      { shopId: shopSilver.id, eventType: AnalyticsEventType.PRODUCT_VIEW, productId: ss1.id, createdAt: new Date() },
      { shopId: shopAroma.id, eventType: AnalyticsEventType.WHATSAPP_CLICK, productId: ap1.id, createdAt: new Date() },
    ],
  });

  console.log('Analytics created successfully.');

  // 7. Create Blog Posts
  console.log('Creating blog posts...');
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

  // Automatically mark all seeded records as beta
  console.log('Flagging all seeded users, shops, and products as beta...');
  await prisma.user.updateMany({ data: { isBeta: true } });
  await prisma.shop.updateMany({ data: { isBeta: true } });
  await prisma.product.updateMany({ data: { isBeta: true } });

  // Update discountPercent for all products with a compareAtPrice
  console.log('Calculating discount percentages for seeded products...');
  const productsWithCompare = await prisma.product.findMany({
    where: { compareAtPrice: { not: null } },
  });
  for (const product of productsWithCompare) {
    if (product.compareAtPrice && product.compareAtPrice > product.price) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          discountPercent: (product.compareAtPrice - product.price) / product.compareAtPrice,
        },
      });
    }
  }

  console.log('Seeding complete! 10 shops and 20+ products seeded and flagged as beta successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
