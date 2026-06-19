export interface FAQItem {
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    question: 'What is Seyon?',
    answer:
      'Seyon is a social-commerce storefront platform that gives independent sellers a free, instant online store. Buyers discover products on Seyon and order directly through WhatsApp, Instagram, or Telegram — no payment gateway, no checkout cart, no middlemen.',
  },
  {
    question: 'How do I create a store on Seyon?',
    answer:
      'Sign up for a free seller account, fill in your store details (name, description, logo), and start listing your products. Your storefront goes live immediately — no approval process, no waiting period.',
  },
  {
    question: 'Is Seyon free to use?',
    answer:
      'Yes! Creating a storefront and listing products is completely free. We do not charge commissions, listing fees, or subscription costs. Seyon is free for sellers and buyers alike.',
  },
  {
    question: 'How do buyers pay for products?',
    answer:
      'Seyon does not handle payments. When a buyer clicks "Chat to Buy", they are redirected to WhatsApp (or Instagram/Telegram) to message the seller directly. Payment terms, methods, and delivery are agreed between the buyer and seller privately.',
  },
  {
    question: 'How does WhatsApp ordering work?',
    answer:
      'Each product has a "Chat on WhatsApp" button that opens a pre-filled WhatsApp message with the product name, price, and a link back to the listing. The buyer and seller then negotiate, confirm the order, and arrange payment and delivery — all within WhatsApp.',
  },
  {
    question: 'Can I sell internationally on Seyon?',
    answer:
      'Seyon storefronts are publicly accessible worldwide, so international buyers can discover your products. However, shipping, customs, and payment logistics are handled directly between you and the buyer.',
  },
  {
    question: 'How does the Trust Score work?',
    answer:
      'Every seller has a Trust Score calculated from factors like account age, product listing quality, customer reviews, and report history. A higher Trust Score means better visibility in search results and more buyer confidence.',
  },
  {
    question: 'How do I report a seller or a suspicious listing?',
    answer:
      'Each store and product page has a "Report" option. You can flag listings for being counterfeit, misleading, offensive, or fraudulent. Our moderation team reviews every report and may suspend stores or adjust Trust Scores accordingly.',
  },
];
