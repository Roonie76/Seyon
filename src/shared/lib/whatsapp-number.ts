/**
 * One way to write a phone number.
 *
 * `ShopSchema` normalises on the way in — a bare ten-digit number gains `+91`,
 * anything else gains a `+` — so a stored number written before that rule, or
 * seeded directly into the database, does not match its own normalised form.
 * Comparing a parsed value against a raw stored one therefore reported a change
 * on every save, and `updateShop` reacts to a changed number by unlisting the
 * store. A seller editing their delivery note would have dropped out of the
 * marketplace without being able to guess why.
 *
 * Kept as a separate module rather than exported from the schema so both the
 * schema's preprocessor and the comparison can share it without either owning
 * the other.
 */
export function normaliseWhatsapp(raw: string): string {
  const clean = (raw || '').replace(/[^0-9+]/g, '');
  if (clean.length === 10 && /^[1-9]\d{9}$/.test(clean)) return `+91${clean}`;
  if (clean.length > 0 && !clean.startsWith('+')) return `+${clean}`;
  return clean;
}
