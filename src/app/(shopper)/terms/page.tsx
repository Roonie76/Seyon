import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyHero } from '../privacy/_components/privacy-hero';
import { PrivacySidebar } from '../privacy/_components/privacy-sidebar';
import { MobileTOC } from '../privacy/_components/mobile-toc';
import { PrivacySection } from '../privacy/_components/privacy-section';
import { PrivacyTable } from '../privacy/_components/privacy-table';
import { PrivacyCallout } from '../privacy/_components/privacy-callout';
import { PrivacyContactCard } from '../privacy/_components/privacy-contact-card';
import { GrievanceOfficerBlock } from '@/frontend/components/shared/grievance-officer-block';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'These Terms explain the rules for using Seyon. By creating an account or using Seyon, you agree to these Terms.',
};

const sections = [
  { id: 'overview', label: '1. Overview' },
  { id: 'how-seyon-works', label: '2. How Seyon Works' },
  { id: 'eligibility', label: '3. Eligibility' },
  { id: 'your-account', label: '4. Your Account' },
  { id: 'seller-responsibilities', label: '5. Seller Responsibilities' },
  { id: 'buyer-responsibilities', label: '6. Buyer Responsibilities' },
  { id: 'marketplace-rules', label: '7. Marketplace Rules' },
  { id: 'who-is-responsible', label: '8. Who Is Responsible?' },
  { id: 'verified-sellers', label: '9. Verified Sellers' },
  { id: 'payments', label: '10. Payments' },
  { id: 'whatsapp-orders', label: '11. WhatsApp Orders' },
  { id: 'intellectual-property', label: '12. Intellectual Property' },
  { id: 'prohibited-activities', label: '13. Prohibited Activities' },
  { id: 'reporting-issues', label: '14. Reporting Issues' },
  { id: 'suspension-and-termination', label: '15. Suspension & Termination' },
  { id: 'disclaimers', label: '16. Disclaimers' },
  { id: 'limitation-of-liability', label: '17. Limitation of Liability' },
  { id: 'changes-to-these-terms', label: '18. Changes to These Terms' },
  { id: 'governing-law', label: '19. Governing Law' },
  { id: 'contact', label: '20. Contact' },
];

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 max-w-6xl w-full bg-background text-foreground min-h-screen">
      {styleTag}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
        {/* Left Sidebar - Sticky Navigation (Desktop only) */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-24 self-start">
            <PrivacySidebar sections={sections} />
            <PrivacyContactCard email="support@seyon.in" />
          </div>
        </div>

        {/* Right Main Document Content Area */}
        <div className="col-span-1 lg:col-span-9 max-w-3xl">
          {/* Mobile TOC - Collapsible (Mobile/tablet only) */}
          <MobileTOC sections={sections} />

          {/* Hero Section */}
          <PrivacyHero 
            title="Terms of Service"
            subtitle="These Terms explain the rules for using Seyon. By creating an account or using Seyon, you agree to these Terms."
            lastUpdated="July 8, 2026" 
            readingTime="10 min" 
          />

          <p className="text-xs text-zinc-600 font-medium leading-relaxed mb-8">
            Seyon is currently operated for users in India. As Seyon expands to other countries, 
            we&apos;ll update these Terms and may add region-specific terms where required by local law.
          </p>

          {/* Section 1: Overview */}
          <PrivacySection id="overview" title="1. Overview">
            <p>
              Seyon is a discovery marketplace that helps creators showcase and sell products, and helps 
              buyers find them.
            </p>
            <p>
              Seyon helps buyers discover products and connect directly with sellers. Seyon itself does not 
              sell products, fulfill orders, or process payments unless explicitly stated otherwise.
            </p>
          </PrivacySection>

          {/* Section 2: How Seyon Works */}
          <PrivacySection id="how-seyon-works" title="2. How Seyon Works">
            <p>
              This reflects how Seyon actually operates: as a discovery platform connecting buyers and sellers, 
              not as a party to any transaction.
            </p>
            <ol className="list-decimal pl-4 space-y-2.5 text-zinc-600 font-medium my-4">
              <li>A seller creates a storefront</li>
              <li>A buyer discovers products through search or browsing</li>
              <li>The buyer contacts the seller — typically via WhatsApp</li>
              <li>The conversation and any negotiation happens on WhatsApp</li>
              <li>Payment is arranged directly between buyer and seller</li>
              <li>The seller fulfills the order</li>
            </ol>
          </PrivacySection>

          {/* Section 3: Eligibility */}
          <PrivacySection id="eligibility" title="3. Eligibility">
            <p>
              To use Seyon, you must:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium">
              <li>Be at least 18 years old</li>
              <li>Be legally capable of entering into a binding agreement</li>
              <li>Provide accurate information when creating an account</li>
              <li>Comply with all applicable laws in your location</li>
            </ul>
            <p className="mt-4">
              We may refuse or terminate an account if we believe these requirements aren&apos;t met.
            </p>
          </PrivacySection>

          {/* Section 4: Your Account */}
          <PrivacySection id="your-account" title="4. Your Account">
            <p>
              You&apos;re responsible for:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium">
              <li>Keeping your password secure and confidential</li>
              <li>All activity that happens under your account</li>
              <li>Providing accurate, current information about yourself and your store</li>
              <li>Notifying us promptly at <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">support@seyon.in</a> if you suspect unauthorized access to your account</li>
            </ul>
          </PrivacySection>

          {/* Section 5: Seller Responsibilities */}
          <PrivacySection id="seller-responsibilities" title="5. Seller Responsibilities">
            <p>
              If you create a storefront on Seyon, you agree to:
            </p>
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Marketplace conduct</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Provide accurate, honest product descriptions and images</li>
                  <li>Use original product images</li>
                  <li>Set correct, honest pricing</li>
                  <li>Respond to buyers in good faith</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Legal compliance</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Only list products you have the right to sell</li>
                  <li>Respect the intellectual property rights of others</li>
                  <li>Deliver what you advertise, as advertised</li>
                  <li>Comply with all laws applicable to the products you sell</li>
                </ul>
              </div>
            </div>
            <p className="mt-4">
              Sellers are independent from Seyon. You are responsible for your own pricing, inventory, 
              fulfillment, taxes, and compliance obligations.
            </p>
          </PrivacySection>

          {/* Section 6: Buyer Responsibilities */}
          <PrivacySection id="buyer-responsibilities" title="6. Buyer Responsibilities">
            <p>
              As a buyer, you agree to:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium">
              <li>Review store and product information carefully before contacting a seller</li>
              <li>Communicate respectfully with sellers</li>
              <li>Exercise judgment before making advance payments — see <Link href="#payments" className="text-[#A77F3A] hover:underline font-bold">Payments</Link> below</li>
              <li>Report suspected fraud or impersonation to us at <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">support@seyon.in</a></li>
            </ul>
          </PrivacySection>

          {/* Section 7: Marketplace Rules */}
          <PrivacySection id="marketplace-rules" title="7. Marketplace Rules">
            <p>
              Seyon is a discovery platform. Seyon:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-600 font-medium mb-4">
              <li>Does not own, inspect, or hold any inventory listed by sellers</li>
              <li>Is not a party to any transaction between a buyer and a seller</li>
              <li>Does not act as a seller when a store lists a product, and does not act as a buyer when someone purchases from a store</li>
            </ul>

            <blockquote className="border-l-2 border-amber-500 bg-[#FCFAF7] p-3 text-[11px] font-semibold text-zinc-700 italic rounded-r-lg">
              Seyon is not a party to transactions between buyers and sellers.
            </blockquote>

            <p className="mt-4">
              Sellers are solely responsible for the products they list and the transactions they complete. 
              Seyon provides the platform that connects buyers and sellers, but does not guarantee any 
              transaction, delivery, or outcome.
            </p>

            <PrivacyCallout type="info">
              This section defines Seyon&apos;s legal status as an intermediary/marketplace platform. It should 
              be reviewed by legal counsel against India&apos;s IT Rules, 2021 and the Consumer Protection 
              (E-Commerce) Rules, 2020 before publication, as these may impose specific disclosure obligations 
              depending on how Seyon is classified.
            </PrivacyCallout>
          </PrivacySection>

          {/* Section 8: Who Is Responsible? */}
          <PrivacySection id="who-is-responsible" title="8. Who Is Responsible?">
            <PrivacyTable
              headers={['Situation', 'Responsible party']}
              rows={[
                ['Product description & images', 'Seller'],
                ['Payment arrangements', 'Buyer & Seller'],
                ['WhatsApp conversations', 'Buyer & Seller (via WhatsApp)'],
                ['Marketplace operation & discovery', 'Seyon'],
                ['Account security', 'User'],
                ['Verification of seller identity', 'Seyon'],
                ['Outcome of a specific transaction', 'Buyer & Seller'],
              ]}
            />
          </PrivacySection>

          {/* Section 9: Verified Sellers */}
          <PrivacySection id="verified-sellers" title="9. Verified Sellers">
            <p>
              Some stores display a Verified badge. Verification confirms that Seyon verified the seller&apos;s 
              identity at the time the verification was completed. It does not:
            </p>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-600 font-medium">
              <li>Guarantee product quality</li>
              <li>Guarantee delivery</li>
              <li>Guarantee the outcome of any transaction</li>
            </ul>
            <p className="mt-4 font-bold text-zinc-950">
              Always use judgment when making a purchase, verified store or not.
            </p>
          </PrivacySection>

          {/* Section 10: Payments */}
          <PrivacySection id="payments" title="10. Payments">
            <p>
              All payments are arranged directly between buyers and sellers. Seyon does not process, hold, 
              or guarantee any payment.
            </p>
            <p>
              If a seller requests payment before delivery, consider using payment methods that provide 
              appropriate buyer protections where available, and exercise caution before paying the full amount 
              in advance.
            </p>
            <p className="border-l-2 border-zinc-200 pl-3 font-semibold text-zinc-700">
              Seyon will never contact you asking for payment on behalf of a seller. If a &quot;store&quot; 
              contacts you first, or asks for full payment upfront, treat it as a red flag and report it to us.
            </p>
          </PrivacySection>

          {/* Section 11: WhatsApp Orders */}
          <PrivacySection id="whatsapp-orders" title="11. WhatsApp Orders">
            <p>
              When you contact a seller through a store&apos;s WhatsApp link, your conversation moves to WhatsApp.
            </p>
            <p>
              That conversation — and anything agreed within it — is governed by WhatsApp&apos;s own terms 
              and privacy policy, not by Seyon. Seyon does not have access to the content of those 
              conversations and is not a party to them.
            </p>
          </PrivacySection>

          {/* Section 12: Intellectual Property */}
          <PrivacySection id="intellectual-property" title="12. Intellectual Property">
            <p>
              Sellers retain ownership of their product photos, descriptions, store branding, and logos. 
              By listing content on Seyon, you grant us a limited license to display that content on the 
              platform for the purpose of operating and promoting Seyon.
            </p>
            <p>
              You represent that you have the necessary rights to upload, publish, and license any content 
              you submit to Seyon.
            </p>
            <p>
              You may not copy, reproduce, or reuse another seller&apos;s product photos, descriptions, or 
              branding without their permission. If you believe your intellectual property has been used 
              without authorization, contact us at <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">support@seyon.in</a>.
            </p>
          </PrivacySection>

          {/* Section 13: Prohibited Activities */}
          <PrivacySection id="prohibited-activities" title="13. Prohibited Activities">
            <p>
              You agree not to:
            </p>
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Fraud</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Impersonate another store, seller, or person</li>
                  <li>Engage in fraud or attempt to scam another user</li>
                  <li>Post fake reviews</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Content</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>List counterfeit or illegal products</li>
                  <li>Violate another party&apos;s intellectual property rights</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Platform abuse</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Circumvent or interfere with Seyon&apos;s security or verification systems</li>
                  <li>Use automation, spam, or bots to abuse the platform</li>
                </ul>
              </div>
            </div>
          </PrivacySection>

          {/* Section 14: Reporting Issues */}
          <PrivacySection id="reporting-issues" title="14. Reporting Issues">
            <p>
              If you encounter fraud, counterfeit goods, impersonation, or illegal content, please report 
              it immediately at <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">support@seyon.in</a>.
            </p>
          </PrivacySection>

          {/* Section 15: Suspension & Termination */}
          <PrivacySection id="suspension-and-termination" title="15. Suspension & Termination">
            <p>
              We may suspend, restrict, or remove a storefront or account if we reasonably believe these 
              Terms have been violated. When a storefront is suspended, it is hidden immediately while we 
              review the matter. Where appropriate, we may notify you before or after taking action.
            </p>
            <p>
              You may also close your account at any time through your account settings. See our Privacy 
              Policy for how your information is handled after account closure.
            </p>
          </PrivacySection>

          {/* Section 16: Disclaimers */}
          <PrivacySection id="disclaimers" title="16. Disclaimers">
            <p>
              Seyon provides the marketplace platform &quot;as is.&quot; Transactions are entered into 
              directly between buyers and sellers. We do not guarantee the accuracy of any listing, the 
              conduct of any user, or the outcome of any transaction.
            </p>
            <p>
              Nothing in these Terms limits rights that cannot be excluded under applicable law.
            </p>
          </PrivacySection>

          {/* Section 17: Limitation of Liability */}
          <PrivacySection id="limitation-of-liability" title="17. Limitation of Liability">
            <PrivacyCallout type="info" title="Legal Advisory Note">
              This section requires drafting by qualified legal counsel. It should define, at minimum: 
              the scope of Seyon&apos;s liability (if any) for disputes between buyers and sellers, a cap 
              on liability where legally permitted, and carve-outs required by Indian consumer protection 
              law. Do not publish generic boilerplate here — this is the section most likely to be tested 
              if a dispute escalates.
            </PrivacyCallout>
          </PrivacySection>

          {/* Section 18: Changes to These Terms */}
          <PrivacySection id="changes-to-these-terms" title="18. Changes to These Terms">
            <p>
              If we make significant changes to these Terms, we&apos;ll notify you by email or through a notice 
              on Seyon. Minor changes will simply update the &quot;Last updated&quot; date above. Continued 
              use of Seyon after changes take effect means you accept the updated Terms.
            </p>
          </PrivacySection>

          {/* Section 19: Governing Law */}
          <PrivacySection id="governing-law" title="19. Governing Law">
            <p>
              These Terms are governed by the laws of India. Any disputes will be subject to the jurisdiction 
              of the competent courts of [City], India, unless applicable law provides otherwise.
            </p>
            <PrivacyCallout type="info">
              City to be confirmed by legal counsel.
            </PrivacyCallout>
          </PrivacySection>

          {/* Section 20: Contact */}
          <PrivacySection id="contact" title="20. Contact">
            <div className="space-y-4">
              <div>
                <p className="font-semibold">
                  General support:{' '}
                  <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">
                    support@seyon.in
                  </a>
                </p>
              </div>

              <div>
                <p className="font-semibold">
                  Legal questions:{' '}
                  <a href="mailto:legal@seyon.in" className="text-[#A77F3A] hover:underline font-bold">
                    legal@seyon.in
                  </a>
                </p>
              </div>

              <GrievanceOfficerBlock />
            </div>
          </PrivacySection>

          {/* Mobile contact card display (only visible on mobile/tablet at the end of the text) */}
          <div className="lg:hidden mt-8">
            <PrivacyContactCard email="support@seyon.in" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Print stylesheet and accessibility transitions injection using raw HTML style tag
const styleTag = (
  <style
    dangerouslySetInnerHTML={{
      __html: `
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          table {
            page-break-inside: avoid;
            border-color: #000000 !important;
          }
          h1, h2, h3 {
            page-break-after: avoid;
            color: black !important;
          }
          section {
            page-break-inside: avoid;
          }
        }
      `,
    }}
  />
);
