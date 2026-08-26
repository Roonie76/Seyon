import { KycStatus } from '@prisma/client';
import { BadgeCheck, Building2 } from 'lucide-react';

/**
 * Who the buyer is actually dealing with.
 *
 * The Consumer Protection (E-Commerce) Rules, 2020 require a marketplace to
 * display each seller's legal name, principal geographic address and
 * customer-care contact. Seyon takes no payment and ships nothing, so this block
 * is the buyer's only way to know who is on the other end — which makes it more
 * load-bearing here than on a marketplace that stands behind the sale.
 *
 * A privacy tension worth naming rather than burying: many sellers on a platform
 * like this trade from home, and publishing a home address beside a phone number
 * is a real safety question, particularly for women selling alone. The rules
 * require the address; how much of it is shown is a decision to take with
 * counsel. `showFullAddress` exists so that decision is a prop rather than a
 * rewrite — set it false and only city, state and PIN are published, which is
 * enough to place a seller in a jurisdiction without pinning them to a door.
 */

interface SellerLegalDetailsProps {
  legalName: string | null;
  kycStatus: KycStatus | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  whatsapp: string;
  /** Publish the street address, or only the locality. Default: locality only. */
  showFullAddress?: boolean;
}

export function SellerLegalDetails({
  legalName,
  kycStatus,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
  whatsapp,
  showFullAddress = false,
}: SellerLegalDetailsProps) {
  const locality = [city, state, postalCode].filter(Boolean).join(', ');
  const street = showFullAddress
    ? [addressLine1, addressLine2].filter(Boolean).join(', ')
    : null;
  const address = [street, locality, country].filter(Boolean).join(', ');

  // Nothing on file yet. Say so plainly rather than printing an empty block:
  // a buyer reading "seller details" with nothing under it learns less than
  // one told the seller has not provided them.
  const hasDetails = Boolean(legalName || locality);

  return (
    <section
      data-testid="seller-details"
      aria-labelledby="seller-details-heading"
      className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        <h2 id="seller-details-heading" className="text-xs font-bold uppercase tracking-wider text-zinc-700">
          Seller details
        </h2>
        {kycStatus === KycStatus.APPROVED ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
            Identity verified
          </span>
        ) : null}
      </div>

      {hasDetails ? (
        <dl className="space-y-1.5 text-xs text-zinc-700">
          {legalName ? (
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-900 min-w-24">Legal name</dt>
              <dd>{legalName}</dd>
            </div>
          ) : null}
          {address ? (
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-900 min-w-24">Address</dt>
              <dd>{address}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="font-semibold text-zinc-900 min-w-24">Contact</dt>
            <dd>
              <a
                href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`}
                className="text-[#A77F3A] hover:underline font-semibold"
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp the seller
              </a>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-zinc-600">
          This seller has not yet published their business details.
        </p>
      )}

      <p className="mt-4 border-t border-zinc-200/70 pt-3 text-[11px] leading-relaxed text-zinc-500">
        Seyon is a discovery marketplace. This seller — not Seyon — sells the
        goods, takes the payment and fulfils the order. Returns, refunds and
        cancellations are set by the seller; ask them before you pay. See our{' '}
        <a href="/returns" className="font-semibold text-[#A77F3A] hover:underline">
          returns policy
        </a>{' '}
        for how we handle complaints about a seller.
      </p>
    </section>
  );
}
