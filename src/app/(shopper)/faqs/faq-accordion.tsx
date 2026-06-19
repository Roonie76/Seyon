'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-900/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-white text-sm pr-4">{question}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-4">
            {answer}
          </div>
        </div>
      </div>
    </div>
  );
}

const faqs = [
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

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => (
        <FAQItem
          key={index}
          question={faq.question}
          answer={faq.answer}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
        />
      ))}
    </div>
  );
}

// Export the raw FAQ data for JSON-LD generation in the server component
export { faqs };
