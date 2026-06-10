/**
 * Pure helpers for the chat-to-buy flow: parsing seller-entered option strings
 * and composing the prefilled WhatsApp order message.
 */

export interface OptionGroup {
  label: string | null;
  values: string[];
}

/**
 * Parses "Sizes: S, M, L · Colors: Red, Black" into selectable chip groups.
 * Group separators: "·", "|", or ";". Values separated by ",".
 * Plain text without ":" renders as a single unnamed group.
 */
export function parseOptions(raw: string): OptionGroup[] {
  return raw
    .split(/[·|;]/)
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const colonIdx = group.indexOf(':');
      const label = colonIdx > 0 ? group.slice(0, colonIdx).trim() : null;
      const valuesRaw = colonIdx > 0 ? group.slice(colonIdx + 1) : group;
      const values = valuesRaw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      return { label, values };
    })
    .filter((g) => g.values.length > 0);
}

export function buildOrderMessage(args: {
  productName: string;
  shopName: string;
  price: number;
  productUrl: string;
  selections: Record<string, string>;
  inStock: boolean;
}): string {
  const { productName, shopName, price, productUrl, selections, inStock } = args;
  const picked = Object.entries(selections)
    .map(([label, value]) => (label === '_' ? value : `${label}: ${value}`))
    .join(', ');

  if (!inStock) {
    return `Hi! I'm interested in "${productName}" from your shop "${shopName}" on Seyon. It shows as sold out — could you let me know when it's back in stock? ${productUrl}`;
  }

  const optionsPart = picked ? ` (${picked})` : '';
  return `Hi! I want to order: ${productName}${optionsPart} — ₹${price.toFixed(2)} from "${shopName}" on Seyon. ${productUrl}`;
}
