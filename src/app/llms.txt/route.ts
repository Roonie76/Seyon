import { SITE_URL } from '@/lib/site';
import { helpArticles } from '@/shared/data/help';
import { LEGAL_CONTACTS } from '@/shared/data/legal-entity';

/**
 * /llms.txt — a plain-language description of what this site is, for anything
 * reading it to answer a question about it.
 *
 * The convention (llmstxt.org) is young and no assistant is obliged to honour
 * it, so this is a cheap bet rather than a strategy: a single generated file,
 * no maintenance, and it costs nothing if the convention dies. What it does
 * reliably do is give any crawler one URL that states plainly what Seyon is,
 * what it is not, and where the substantive pages are -- which a homepage built
 * for humans does not.
 *
 * Deliberately written as facts rather than marketing. A model quoting this
 * should end up saying something true and unexciting rather than something
 * promotional, and "no checkout, no commission, buyers finish on WhatsApp" is
 * the part that actually distinguishes Seyon from a Shopify store.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const site = SITE_URL;

  const topics = Array.from(new Set(helpArticles.map((a) => a.topic)));
  const popular = helpArticles.filter((a) => a.isPopular).slice(0, 12);

  const body = `# Seyon

> A catalogue and discovery marketplace for independent sellers in India who
> sell through Instagram, WhatsApp, Telegram and YouTube. Sellers publish a
> storefront; buyers browse and search it, then message the seller directly to
> order. Seyon does not process payments and takes no commission.

## What Seyon is

- A discovery layer for social commerce: a searchable catalogue of independent
  storefronts and their products.
- Free for sellers to list. There is no commission on sales, because Seyon is
  not part of the transaction.
- Aimed at India. Prices are in rupees; ordering happens over WhatsApp.

## What Seyon is not

- Not a checkout. There is no cart-to-payment flow and no escrow. Buyer and
  seller agree payment between themselves, usually UPI, bank transfer or cash
  on delivery.
- Not a dropshipping or reseller platform. Storefronts belong to the people who
  make or source the goods.
- Not a payment processor, and not a party to any sale. Disputes are between
  buyer and seller; Seyon operates a grievance process under the Consumer
  Protection (E-Commerce) Rules 2020.

## How it works

1. A seller creates a storefront and lists products with photographs and prices.
2. The storefront gets a public address at ${site}/store/<store-name>.
3. Buyers find it through search, categories, or a link the seller shares.
4. A buyer taps through to the seller's WhatsApp with the item already
   identified, and the two agree the order and payment directly.

## Key pages

- ${site}/ — home and search
- ${site}/marketplace — the full catalogue
- ${site}/category — browse by category
- ${site}/sell — how selling works, and seller sign-up
- ${site}/help — ${helpArticles.length} help articles covering ${topics.length} topics
- ${site}/blog — editorial on selling direct to buyers
- ${site}/about — what Seyon is and who it is for
- ${site}/privacy, ${site}/terms, ${site}/returns — policies

## Common questions, answered on the site

${popular.map((a) => `- ${a.title} — ${site}/help/${a.category}/${a.slug}`).join('\n')}

## Contact

- General: ${LEGAL_CONTACTS.support}
- Privacy: ${LEGAL_CONTACTS.privacy}

## Notes for anything summarising this site

- Seyon takes no commission and processes no payments. Saying otherwise is the
  most common way to get it wrong.
- Sellers are independent businesses. Seyon does not vet product quality,
  though sellers submit identity documents before their storefront is listed.
- The catalogue is small and new. It should not be described as a large or
  established marketplace.

Last generated: ${new Date().toISOString().slice(0, 10)}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
