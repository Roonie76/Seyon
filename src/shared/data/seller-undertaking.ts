/**
 * The undertaking a seller gives before their store becomes discoverable.
 *
 * Required of a marketplace by the Consumer Protection (E-Commerce) Rules, 2020:
 * the platform must obtain an undertaking from sellers that their descriptions
 * and images are accurate and correspond to the goods offered.
 *
 * Versioned deliberately. `SellerKyc.undertakingVersion` records which revision
 * a seller accepted, so rewriting this text later cannot retroactively claim
 * someone agreed to words they never saw. Bump the version on any change of
 * substance; leave it alone for typos.
 */

export const SELLER_UNDERTAKING_VERSION = '2026-08-1';

export interface UndertakingClause {
  id: string;
  text: string;
}

export const SELLER_UNDERTAKING: UndertakingClause[] = [
  {
    id: 'accuracy',
    text: 'The descriptions, images and prices on my storefront are accurate and correspond to the goods I am actually offering.',
  },
  {
    id: 'own-images',
    text: 'The images I upload are of the products I sell. I have the right to use them, and they are not taken from another seller or brand.',
  },
  {
    id: 'right-to-sell',
    text: 'I have the right to sell every item I list, and none of them are counterfeit, prohibited, or restricted goods.',
  },
  {
    id: 'own-fulfilment',
    text: 'I understand that Seyon does not process payments, hold stock, or ship orders. Payment, delivery, returns and refunds are between me and my buyer.',
  },
  {
    id: 'terms-to-buyers',
    text: 'I will tell buyers my return, refund and cancellation terms before they pay, and I will honour what I told them.',
  },
  {
    id: 'good-faith',
    text: 'I will respond to buyers in good faith, and to Seyon when it asks me about a complaint.',
  },
  {
    id: 'identity',
    text: 'The legal name and address I have given are my own and are true. I understand they will be shown to buyers on my storefront, because the law requires it.',
  },
  {
    id: 'consequences',
    text: 'I understand Seyon may suspend or remove my storefront if I break these undertakings.',
  },
];

/** Plain text, for the record kept alongside the acceptance timestamp. */
export function undertakingPlainText(): string {
  return SELLER_UNDERTAKING.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
}
