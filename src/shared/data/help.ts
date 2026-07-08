export type HelpCategory = 'common' | 'buyer' | 'seller';

export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategory;
  topic: string;
  content: string;
  lastUpdated: string;
  isPopular?: boolean;
}

export const helpArticles: HelpArticle[] = [
  // --- COMMON HELP: About Seyon ---
  {
    slug: 'what-is-seyon',
    title: 'What is Seyon?',
    category: 'common',
    topic: 'About Seyon',
    content: `Seyon is a catalog and discovery platform designed specifically for independent creators, artists, boutiques, and brands who sell their products directly through social channels like Instagram, WhatsApp, Telegram, and YouTube.

Instead of forcing creators to integrate complex, expensive payment gateways and checkout carts, Seyon provides an elegant, instant storefront catalog. Buyers can browse, search, and discover unique products, then connect directly with the creators to complete their purchase.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },
  {
    slug: 'how-is-seyon-different-from-other-e-commerce',
    title: 'How is Seyon different from other E-Commerce?',
    category: 'common',
    topic: 'About Seyon',
    content: `Traditional e-commerce platforms act as middle-agents. They control the checkout process, process payments, manage deliveries, handle customer returns, and charge commission fees on every transaction.

Seyon is a discovery platform, not a checkout processor:
* **No Middleman**: Seyon does not process payments or manage shipping logistics.
* **Direct Connection**: We connect buyers directly with creators.
* **Zero Commissions**: Because transactions happen directly between the buyer and the creator, Seyon does not charge commission fees.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },
  {
    slug: 'why-does-seyon-redirect-to-whatsapp',
    title: 'Why does Seyon redirect to WhatsApp?',
    category: 'common',
    topic: 'About Seyon',
    content: `Most independent creators and boutiques already run their businesses through direct messaging channels (WhatsApp, Instagram DM, Telegram). It allows them to negotiate custom pricing, manage custom order details, and offer a personal shopping experience.

Seyon redirects buyers directly to WhatsApp with a prefilled purchase inquiry message. This allows creators to keep their existing conversational workflow while solving the problem of catalog discovery and searchability for buyers.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'does-seyon-process-payments',
    title: 'Does Seyon process payments?',
    category: 'common',
    topic: 'About Seyon',
    content: `No. Seyon never processes payments, holds customer funds, or uses any payment gateway integrations.

All financial transactions occur directly between the buyer and the seller. Once you click "Talk to Creator" and are redirected to their chat channel, you will agree on the payment method (such as UPI, Bank Transfer, or Cash on Delivery) directly with the seller.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },
  {
    slug: 'does-seyon-deliver-products',
    title: 'Does Seyon deliver products?',
    category: 'common',
    topic: 'About Seyon',
    content: `No. Seyon does not offer shipping or fulfillment services.

All shipping, packaging, and delivery logistics are managed entirely by the seller. When confirming your order with the creator, they will provide their shipping options, couriers, tracking details, and estimated delivery timelines.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'does-seyon-offer-refunds',
    title: 'Does Seyon offer refunds?',
    category: 'common',
    topic: 'About Seyon',
    content: `No. Seyon does not handle transaction funds, which means we cannot process refunds, order cancellations, or returns.

All refunds, exchanges, and returns are strictly governed by the individual creator's store policies. We recommend verifying a seller's refund and return policies on their storefront page or during your chat conversation before completing your payment.`,
    lastUpdated: '2026-06-30',
  },

  // --- COMMON HELP: Trust & Safety ---
  {
    slug: 'how-are-creators-verified',
    title: 'How are creators verified?',
    category: 'common',
    topic: 'Trust & Safety',
    content: `To protect the marketplace community, Seyon offers a verification badge to trusted creators.

Verified creators undergo a manual review process where they confirm their identity, social media ownership, active seller history, and business registrations. Creators with a verification badge display a gold checkmark icon on their storefront and product catalog pages.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'can-i-report-a-fraudulent-seller',
    title: 'Can I report a fraudulent seller?',
    category: 'common',
    topic: 'Trust & Safety',
    content: `Yes. Seyon is committed to maintaining a safe marketplace.

If you suspect a listing is counterfeit, fraudulent, misleading, or violates marketplace policies, you can report it. Every product page and storefront features a "Report" link. Submitting a report flags the listing for review by our moderation team.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'what-happens-after-i-report-fraud',
    title: 'What happens after I report fraud?',
    category: 'common',
    topic: 'Trust & Safety',
    content: `Our dedicated moderation team reviews all submitted reports and logs. If a seller is found to be in violation of our marketplace rules, Seyon will take immediate action, which may include:
* Removing the offending product listings.
* Deducting points from their storefront Trust Score.
* Temporary store suspensions.
* Permanent bans and IP blocks for repeat offenders.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'can-seyon-recover-my-money',
    title: 'Can Seyon recover my money?',
    category: 'common',
    topic: 'Trust & Safety',
    content: `No. Because Seyon is not involved in the payment process and never handles or holds any transaction funds, we do not have the technical or financial capability to reverse transactions or refund payments.

If you believe you have been scammed, we recommend contacting your bank or payment provider (e.g., your UPI app, GPay, PhonePe, or credit card issuer) immediately to report the transaction. You should also report the store on Seyon so our moderation team can suspend the fraudulent account.`,
    lastUpdated: '2026-06-30',
  },

  // --- BUYER HELP: Discovering Products ---
  {
    slug: 'how-do-i-search',
    title: 'How do I search for products?',
    category: 'buyer',
    topic: 'Discovering Products',
    content: `You can search for products, creators, and stores using the global search bar at the top of the Seyon page.

Our search engine queries keywords across product titles, descriptions, categories, tag list filters, and store names. As you type, you will also receive live auto-suggestions for quick navigation.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'how-do-categories-work',
    title: 'How do categories work?',
    category: 'buyer',
    topic: 'Discovering Products',
    content: `All products on Seyon are organized into major categories (such as Beauty, Home, Clothing, Jewelry, and Crafts).

You can browse items by selecting a category from the navigation menu or filtering search results. This helps you quickly find specific types of items across different independent creator catalogs.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'how-do-collections-work',
    title: 'How do collections work?',
    category: 'buyer',
    topic: 'Discovering Products',
    content: `Collections are curated groupings of products based on seasonal trends, themes, or styles (e.g., "Handmade Decors", "Summer Essentials").

Browsing collections is a great way to discover new products and creative studios you might not have searched for directly.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'how-do-i-discover-creators',
    title: 'How do I discover creators?',
    category: 'buyer',
    topic: 'Discovering Products',
    content: `You can discover creators in three main ways:
1. **Creators Page**: Visit the dedicated Creators section to see a list of verified storefronts, sorted by rating and category.
2. **Product Page Info**: Every product page prominently displays the name and logo of the shop that created it, linking back to their full storefront catalog.
3. **Featured Spotlights**: Explore the homepage to see spotlighted studios and popular creators.`,
    lastUpdated: '2026-06-30',
  },

  // --- BUYER HELP: Buying ---
  {
    slug: 'how-do-i-buy',
    title: 'How do I buy?',
    category: 'buyer',
    topic: 'Buying',
    content: `Buying on Seyon is straightforward:
1. **Browse & Select**: Find a product you love on the marketplace.
2. **Review Details**: Check the product description, price, delivery details, and seller rating on the product detail page.
3. **Talk to Creator**: Click the **Talk to Creator** button.
4. **Chat on WhatsApp**: You will be redirected to WhatsApp (or Instagram/Telegram) with a prefilled message containing the item details and link.
5. **Finalize**: Discuss UPI/COD payment options, customization details, and shipping address directly with the creator in chat.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },
  {
    slug: 'can-i-negotiate-prices',
    title: 'Can I negotiate prices?',
    category: 'buyer',
    topic: 'Buying',
    content: `Yes. Since you are connecting directly with the seller in a personal chat channel, you are free to discuss custom bundles, bulk order discounts, or promotional negotiations as permitted by the creator.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'can-i-request-customization',
    title: 'Can I request customization?',
    category: 'buyer',
    topic: 'Buying',
    content: `Yes! Many creators on Seyon specialize in custom and handmade goods (such as custom embroidery, custom scents, or size alterations).

When you start your chat on WhatsApp, simply ask the creator if they offer customizations for that product. They can adjust the order details and quote you a custom price directly in the chat.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'can-i-save-products',
    title: 'Can I save products?',
    category: 'buyer',
    topic: 'Buying',
    content: `Yes. You can save products you like to your personal Wishlist by clicking the **heart icon** on any product card or detail page.

You can access your saved items anytime by clicking the heart icon in the main navigation header.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'can-i-contact-multiple-sellers',
    title: 'Can I contact multiple sellers?',
    category: 'buyer',
    topic: 'Buying',
    content: `Yes. You can initiate chats with as many independent creators as you want. Each click will open a separate chat thread, letting you discuss details and finalize purchases with each seller individually.`,
    lastUpdated: '2026-06-30',
  },

  // --- BUYER HELP: If Something Goes Wrong ---
  {
    slug: 'seller-isnt-responding',
    title: 'What if the seller is not responding?',
    category: 'buyer',
    topic: 'If Something Goes Wrong',
    content: `If a creator does not respond immediately, please give them some time. Many sellers are small, independent teams who may be outside business hours or working on craft orders.

If a seller fails to respond after multiple days or repeatedly abandons inquiries, you can flag their storefront. Seyon monitors inactive stores and may pause storefront visibility to keep the marketplace active.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'i-think-this-is-a-fake-listing',
    title: 'I think this is a fake or scam listing',
    category: 'buyer',
    topic: 'If Something Goes Wrong',
    content: `If you encounter a listing that uses stolen photos, has misleading prices, or looks suspicious, do not message the seller.

Instead, click the **Report** button on the product page or storefront. Provide details about why you suspect it is fake. Our moderation team will investigate the listing and remove it if it violates our policies.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'i-paid-but-never-received-my-product',
    title: 'I paid but never received my product',
    category: 'buyer',
    topic: 'If Something Goes Wrong',
    content: `If you have completed a transaction directly with a seller but they have not shipped the product or have stopped responding:
1. **Contact the Seller**: Check their chat thread for tracking info or shipping updates.
2. **File a Fraud Report**: Click **Report Store** on their Seyon storefront, select "Fraud/Non-delivery", and attach details of the transaction.
3. **Contact Payment Provider**: Report the transaction to your bank or UPI provider to freeze/dispute the payment.

Seyon takes fraud reports seriously. We will audit the shop immediately and permanently ban their account and details from our platform if fraud is confirmed.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },

  // --- SELLER HELP: Getting Started ---
  {
    slug: 'who-can-sell',
    title: 'Who can sell on Seyon?',
    category: 'seller',
    topic: 'Getting Started',
    content: `Seyon is designed for independent creators, handmade artists, boutiques, curators, and local brands.

If you list products on Instagram, WhatsApp catalog, or other social platforms and want an elegant, structured storefront link for your customers to browse and search your inventory, Seyon is built for you.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'is-seyon-free',
    title: 'Is Seyon free to use?',
    category: 'seller',
    topic: 'Getting Started',
    content: `Yes! Seyon is completely free.
* **No Setup Fees**: Setting up your account and catalog is free.
* **No Listing Fees**: List unlimited products without paying a fee.
* **Zero Transaction Commissions**: Because buyers pay you directly on WhatsApp/chat, Seyon does not deduct any transaction commissions. You keep 100% of your earnings.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },
  {
    slug: 'do-i-need-a-website',
    title: 'Do I need a website?',
    category: 'seller',
    topic: 'Getting Started',
    content: `No. Seyon replaces the need for an expensive e-commerce website. We provide you with a clean, mobile-optimized shop page link (e.g., \`seyon.in/store/your-store\`) that you can add to your Instagram bio, Linktree, or share directly with buyers.`,
    lastUpdated: '2026-06-30',
  },
  {
    slug: 'do-i-need-gst',
    title: 'Do I need a GST registration to sell?',
    category: 'seller',
    topic: 'Getting Started',
    content: `Seyon does not collect or check tax registrations. You are only required to register for GST or local business tax filings if your business exceeds the annual turnover thresholds mandated by national tax laws. We recommend consulting with a tax professional to ensure compliance.`,
    lastUpdated: '2026-06-30',
  },

  // --- SELLER HELP: Store Setup ---
  {
    slug: 'storefront-profile-elements',
    title: 'How do I set up my store profile?',
    category: 'seller',
    topic: 'Store Setup',
    content: `An attractive storefront builds trust with buyers. You can customize the following fields on your seller dashboard:
* **Logo**: A square image representing your brand identity.
* **Banner**: A wide header image for your shop header catalog.
* **Description**: A short profile introduction explaining what you craft or sell.
* **Categories**: Tag the product categories you specialize in.
* **WhatsApp Number**: The WhatsApp number (including country code) where order messages will be sent.
* **Business Hours**: Specify times when you are active to respond to chats.
* **Delivery & Return Policies**: Outline standard shipping times, courier partners, and exchange conditions.`,
    lastUpdated: '2026-06-30',
  },

  // --- SELLER HELP: Products ---
  {
    slug: 'how-do-i-add-products',
    title: 'How do I add products to my catalog?',
    category: 'seller',
    topic: 'Products',
    content: `Adding products is simple:
1. Go to your **Seller Dashboard** → **Products** tab.
2. Click **Add Product**.
3. **Upload Photos**: Add up to 5 quality images displaying your item.
4. **Fill Details**: Add the Title, Description, Category, Tags, Price, and stock status.
5. **Publish**: Save the details to list it live on your store catalog instantly.`,
    lastUpdated: '2026-06-30',
  },

  // --- SELLER HELP: Analytics ---
  {
    slug: 'why-cant-i-see-orders-or-revenue',
    title: 'Why can\'t I see orders or revenue analytics?',
    category: 'seller',
    topic: 'Analytics',
    content: `Seyon tracks storefront performance metrics like:
* **Store Views**: Total visits to your storefront catalog.
* **Product Views**: Clicks and visits to specific item detail pages.
* **WhatsApp Clicks**: Total times customers clicked "Talk to Creator" to initiate a purchase.

Since transactions, payment confirmations, and orders happen directly between you and your customers on WhatsApp or social chats, Seyon cannot track checkout completions, order statuses, or total revenue.`,
    lastUpdated: '2026-06-30',
  },

  // --- SELLER HELP: Trust Rating ---
  {
    slug: 'how-do-i-improve-my-trust-score',
    title: 'How do I improve my store Trust Score?',
    category: 'seller',
    topic: 'Trust Rating',
    content: `Your storefront Trust Score determines your search indexing priority and listing exposure on the marketplace. You can improve it by:
* **Completing your Profile**: Fill out all store settings, including description, hours, and policies.
* **Accurate Product Listings**: Use clear titles, descriptions, and high-quality original photos.
* **Positive Reviews**: Maintain friendly, quick service in chats to encourage buyers to write positive reviews on your page.
* **Zero Reports**: Avoid cancellations, shipping delays, or complaints that could lead to moderation reviews.
* **Verification Badge**: Complete manual business and identity verification to instantly boost your trust rating.`,
    lastUpdated: '2026-06-30',
    isPopular: true,
  },

  // --- SELLER HELP: Store Suspension ---
  {
    slug: 'reasons-for-store-suspension',
    title: 'Why do stores get suspended or banned?',
    category: 'seller',
    topic: 'Store Suspension',
    content: `To ensure buyer safety, Seyon will suspend or ban stores that violate our marketplace rules. Common reasons for account suspension include:
* **Fraud or Non-Delivery**: Accepting payment from a buyer and failing to ship products or respond.
* **Counterfeit Goods**: Listing replica items or using copy-protected brand logos without authorization.
* **Prohibited Products**: Selling illegal goods, weapons, prescription drugs, or adult items.
* **Stolen Content**: Using copyright-protected images, videos, or product descriptions belonging to other creators.
* **Harassment**: Inappropriate, abusive, or threatening communication reported by buyers.`,
    lastUpdated: '2026-06-30',
  },
];
