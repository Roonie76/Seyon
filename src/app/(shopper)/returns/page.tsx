import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyHero } from '../privacy/_components/privacy-hero';
import { PrivacySidebar } from '../privacy/_components/privacy-sidebar';
import { MobileTOC } from '../privacy/_components/mobile-toc';
import { PrivacySection } from '../privacy/_components/privacy-section';
import { PrivacyCallout } from '../privacy/_components/privacy-callout';
import { PrivacyContactCard } from '../privacy/_components/privacy-contact-card';
import { GrievanceOfficerBlock } from '@/frontend/components/shared/grievance-officer-block';
import {
  LEGAL_CONTACTS,
  GRIEVANCE_ACKNOWLEDGEMENT_HOURS,
  GRIEVANCE_RESOLUTION_DAYS,
} from '@/shared/data/legal-entity';

/**
 * Returns, refunds and cancellations.
 *
 * The Consumer Protection (E-Commerce) Rules, 2020 require a marketplace to
 * publish these terms, and to be clear about who is responsible for them. On
 * Seyon that answer is unusual and has to be stated plainly rather than
 * papered over: no payment ever passes through Seyon, so Seyon cannot issue a
 * refund. Writing a conventional "30-day returns" page would be a promise the
 * platform has no mechanism to keep.
 *
 * What Seyon can be accountable for is the marketplace itself — requiring
 * sellers to state their terms, acting on complaints, and removing sellers who
 * do not honour what they advertised. That is what this page commits to.
 */

export const metadata: Metadata = {
  title: 'Returns, Refunds & Cancellations | Seyon',
  description:
    'How returns, refunds and cancellations work on Seyon: terms are set by each seller, payment happens directly between buyer and seller, and Seyon acts on complaints about sellers who do not honour them.',
};

const sections = [
  { id: 'the-short-version', label: 'The short version' },
  { id: 'who-sets-the-terms', label: '1. Who sets the terms' },
  { id: 'before-you-buy', label: '2. Before you buy' },
  { id: 'cancelling-an-order', label: '3. Cancelling an order' },
  { id: 'returns-and-replacements', label: '4. Returns & replacements' },
  { id: 'refunds', label: '5. Refunds' },
  { id: 'if-a-seller-will-not-honour-it', label: '6. If a seller will not honour it' },
  { id: 'what-seyon-does', label: '7. What Seyon does' },
  { id: 'your-statutory-rights', label: '8. Your statutory rights' },
  { id: 'contact', label: '9. Contact' },
];

export default function ReturnsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 max-w-6xl w-full bg-background text-foreground min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-24 self-start">
            <PrivacySidebar sections={sections} />
            <PrivacyContactCard email={LEGAL_CONTACTS.support} />
          </div>
        </div>

        <div className="col-span-1 lg:col-span-9 max-w-3xl">
          <MobileTOC sections={sections} />

          <PrivacyHero
            title="Returns, Refunds & Cancellations"
            subtitle="Seyon is a discovery marketplace. Sales happen directly between you and the seller, which changes who is responsible for a return — this page explains exactly how."
            lastUpdated="August 23, 2026"
            readingTime="4 min"
          />

          <PrivacySection id="the-short-version" title="The short version">
            <PrivacyCallout
              type="glance"
              title="The short version"
              items={[
                'Each seller sets their own return, replacement and cancellation terms.',
                'Payment goes directly to the seller — Seyon never holds your money and cannot issue a refund.',
                'Ask the seller for their terms on WhatsApp before you pay, and keep that message.',
                'If a seller ignores terms they agreed to, report them and we will act on the seller.',
                'Nothing here reduces your rights under the Consumer Protection Act, 2019.',
              ]}
            />
          </PrivacySection>

          <PrivacySection id="who-sets-the-terms" title="1. Who sets the terms">
            <p>
              Every storefront on Seyon is run by an independent seller. They make or source
              the products, set the prices, take the payment and ship the order. Returns,
              replacements, cancellations and refunds are therefore theirs to define and
              theirs to honour.
            </p>
            <p>
              Seyon does not sell anything, does not take a cut of any sale, and never touches
              the payment. We would be misleading you if we published a single returns window
              that applied across the marketplace — we have no way to enforce it at the point
              of payment.
            </p>
          </PrivacySection>

          <PrivacySection id="before-you-buy" title="2. Before you buy">
            <p>
              Because terms vary by seller, the most useful thing you can do takes thirty
              seconds. Before paying, message the seller on WhatsApp and ask:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium my-4">
              <li>Do you accept returns, and within how many days?</li>
              <li>Who pays return shipping?</li>
              <li>Is the item refundable, replaceable, or exchange-only?</li>
              <li>What is the expected delivery time?</li>
            </ul>
            <PrivacyCallout type="info">
              Keep the reply. A WhatsApp message where a seller states their terms is the
              clearest evidence there is, both for the seller and for us if you later report
              a problem.
            </PrivacyCallout>
          </PrivacySection>

          <PrivacySection id="cancelling-an-order" title="3. Cancelling an order">
            <p>
              An order on Seyon is an agreement made in a WhatsApp conversation, not a
              checkout on this site. To cancel, message the seller directly. If you have not
              paid, there is nothing to unwind. If you have paid and the item has not
              shipped, most sellers will cancel and return the payment — but that is between
              you and them.
            </p>
            <p>
              Seyon cannot cancel an order on your behalf, because Seyon was never a party to
              it and has no record of it.
            </p>
          </PrivacySection>

          <PrivacySection id="returns-and-replacements" title="4. Returns & replacements">
            <p>
              Send the seller a message describing the problem, with photographs where the
              item arrived damaged, incorrect, or materially different from what was listed.
              Sellers on Seyon agree, as a condition of listing, to describe products
              accurately and to deliver what they advertised, as advertised.
            </p>
            <p>
              Some categories are commonly non-returnable — perishables, made-to-order and
              personalised items, intimate apparel, and items damaged after delivery. A
              seller may exclude these, but they must tell you before you pay, not after you
              ask.
            </p>
          </PrivacySection>

          <PrivacySection id="refunds" title="5. Refunds">
            <p>
              Refunds are issued by the seller, using whatever method you paid with. Seyon
              cannot issue, reverse, hold or guarantee a refund — no payment ever passes
              through this platform, so there is nothing for us to return.
            </p>
            <PrivacyCallout type="lock">
              Nobody at Seyon will ever ask you to pay Seyon for an order, or offer to
              &quot;process&quot; a refund on a seller&apos;s behalf. If someone does, that is a
              scam — report it to{' '}
              <a
                href={`mailto:${LEGAL_CONTACTS.support}`}
                className="text-[#A77F3A] hover:underline font-bold"
              >
                {LEGAL_CONTACTS.support}
              </a>
              .
            </PrivacyCallout>
          </PrivacySection>

          <PrivacySection
            id="if-a-seller-will-not-honour-it"
            title="6. If a seller will not honour it"
          >
            <p>
              Report the storefront. There is a report control on every store page, and you
              can also write to{' '}
              <a
                href={`mailto:${LEGAL_CONTACTS.support}`}
                className="text-[#A77F3A] hover:underline font-bold"
              >
                {LEGAL_CONTACTS.support}
              </a>
              . Include the store name, what was agreed, and screenshots of the conversation.
            </p>
            <p>
              We acknowledge reports within {GRIEVANCE_ACKNOWLEDGEMENT_HOURS} hours and aim to
              resolve them within {GRIEVANCE_RESOLUTION_DAYS} days.
            </p>
          </PrivacySection>

          <PrivacySection id="what-seyon-does" title="7. What Seyon does">
            <p>
              We are honest about the limit of our power here, and equally honest about what
              sits inside it:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium my-4">
              <li>We require sellers to describe products accurately and price them honestly.</li>
              <li>We investigate every report we receive about a seller.</li>
              <li>
                We suspend storefronts that repeatedly fail to honour what they advertised.
                A suspended storefront stops being visible immediately.
              </li>
              <li>We remove a seller&apos;s verified badge when their conduct no longer merits it.</li>
            </ul>
            <p>
              What we cannot do is move money we never held. Treating a Seyon listing as a
              lead rather than a completed purchase — and asking the questions in section 2
              first — is the practical protection.
            </p>
          </PrivacySection>

          <PrivacySection id="your-statutory-rights" title="8. Your statutory rights">
            <p>
              Nothing on this page limits the rights you have under the Consumer Protection
              Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020. A seller
              cannot contract out of them, and neither can we. If a seller has misled you,
              you may also approach the consumer helpline or a consumer commission
              independently of anything Seyon does.
            </p>
            <p className="mt-2">
              See also our{' '}
              <Link href="/terms" className="text-[#A77F3A] hover:underline font-bold">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-[#A77F3A] hover:underline font-bold">
                Privacy Policy
              </Link>
              .
            </p>
          </PrivacySection>

          <PrivacySection id="contact" title="9. Contact">
            <div className="space-y-4">
              <div>
                <p className="font-semibold">
                  Support:{' '}
                  <a
                    href={`mailto:${LEGAL_CONTACTS.support}`}
                    className="text-[#A77F3A] hover:underline font-bold"
                  >
                    {LEGAL_CONTACTS.support}
                  </a>
                </p>
              </div>
              <GrievanceOfficerBlock />
            </div>
          </PrivacySection>

          <div className="lg:hidden mt-8">
            <PrivacyContactCard email={LEGAL_CONTACTS.support} />
          </div>
        </div>
      </div>
    </div>
  );
}
