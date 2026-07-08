import * as React from 'react';
import { Metadata } from 'next';
import { PrivacyHero } from './_components/privacy-hero';
import { PrivacySidebar } from './_components/privacy-sidebar';
import { MobileTOC } from './_components/mobile-toc';
import { PrivacySection } from './_components/privacy-section';
import { PrivacyTable } from './_components/privacy-table';
import { PrivacyComparison } from './_components/privacy-comparison';
import { PrivacyCallout } from './_components/privacy-callout';
import { PrivacyContactCard } from './_components/privacy-contact-card';

export const metadata: Metadata = {
  title: 'Privacy Policy | Seyon',
  description:
    'Learn how Seyon collects, uses, and protects your information when discovering and shopping from creator storefronts.',
};

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'information-we-collect', label: '1. Information We Collect' },
  { id: 'how-we-use-your-information', label: '2. How We Use Your Information' },
  { id: 'public-vs-private-information', label: '3. Public vs Private Information' },
  { id: 'marketplace-transparency', label: '4. Marketplace Transparency' },
  { id: 'cookies-and-analytics', label: '5. Cookies & Analytics' },
  { id: 'data-sharing', label: '6. Data Sharing' },
  { id: 'data-retention', label: '7. Data Retention' },
  { id: 'security', label: '8. Security' },
  { id: 'your-choices', label: '9. Your Choices' },
  { id: 'your-rights', label: '10. Your Rights' },
  { id: 'childrens-privacy', label: "11. Children's Privacy" },
  { id: 'changes-to-this-policy', label: '12. Changes to This Policy' },
  { id: 'contact-and-grievance-officer', label: '13. Contact & Grievance Officer' },
];

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 max-w-6xl w-full bg-background text-foreground min-h-screen">
      {styleTag}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
        {/* Left Sidebar - Sticky Navigation (Desktop only) */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-24 self-start">
            <PrivacySidebar sections={sections} />
            <PrivacyContactCard email="privacy@seyon.in" />
          </div>
        </div>

        {/* Right Main Document Content Area */}
        <div className="col-span-1 lg:col-span-9 max-w-3xl">
          {/* Mobile TOC - Collapsible (Mobile/tablet only) */}
          <MobileTOC sections={sections} />

          {/* Hero Section */}
          <PrivacyHero lastUpdated="July 8, 2026" readingTime="7 min" />

          {/* Section: Overview / Glance */}
          <PrivacySection id="overview" title="Privacy at a glance">
            <PrivacyCallout
              type="glance"
              title="Privacy at a glance"
              items={[
                'Your email is never shown publicly.',
                'Your public storefront is separate from your private account information.',
                'You decide which social profiles, if any, appear on your storefront.',
                'You can request deletion of your account at any time.',
                "We don't have access to your WhatsApp conversations with buyers or sellers.",
                'This page explains exactly what information we collect and why.',
              ]}
            />
          </PrivacySection>

          {/* Section 1: Information We Collect */}
          <PrivacySection id="information-we-collect" title="1. Information We Collect">
            <p>
              We collect only the information needed to provide and improve Seyon.
            </p>

            <div className="space-y-6 mt-4">
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Account Information</h3>
                <p className="text-zinc-500 font-semibold text-[11px] mb-2">
                  Information you provide to create and manage your account.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Password (stored encrypted — we never store it in plain text and cannot see it)</li>
                  <li>Phone number (optional — used only to power a WhatsApp contact link on your storefront, if you choose to add one)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Store Information</h3>
                <p className="text-zinc-500 font-semibold text-[11px] mb-2">
                  Information that makes up your public storefront.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Store name</li>
                  <li>Store description</li>
                  <li>Product listings and images</li>
                  <li>Categories and collections</li>
                  <li>Social media links (if you choose to add them)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Technical Information</h3>
                <p className="text-zinc-500 font-semibold text-[11px] mb-2">
                  Information collected automatically when you use Seyon.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Browser and device type</li>
                  <li>IP address</li>
                  <li>Session and log data</li>
                  <li>Crash and diagnostic reports</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Support Information</h3>
                <p className="text-zinc-500 font-semibold text-[11px] mb-2">
                  Information generated when you contact Seyon support directly.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Support requests and correspondence</li>
                </ul>
              </div>
            </div>

            <PrivacyCallout type="info">
              We do not host in-platform messaging, and we do not collect or store conversations 
              you have with buyers or sellers on WhatsApp.
            </PrivacyCallout>
          </PrivacySection>

          {/* Section 2: How We Use Your Information */}
          <PrivacySection id="how-we-use-your-information" title="2. How We Use Your Information">
            <PrivacyTable
              headers={['Information', 'Why we use it']}
              rows={[
                ['Email', 'Login, account recovery, and important notifications'],
                ['Store & product data', 'Display your storefront and make it discoverable'],
                ['Phone number', 'Power your optional WhatsApp contact link'],
                ['Technical data', 'Keep Seyon secure and prevent fraud'],
                ['Usage data', 'Understand how Seyon is used so we can improve it'],
                ['Support data', 'Respond to your questions and provide support'],
              ]}
            />
            <PrivacyCallout type="lock">
              We do not use your private account information — your email, password, or device data 
              — to power marketplace discovery or search ranking.
            </PrivacyCallout>
          </PrivacySection>

          {/* Section 3: Public vs Private Information */}
          <PrivacySection id="public-vs-private-information" title="3. Public vs Private Information">
            <PrivacyComparison
              visibleTitle="Visible to everyone"
              visibleItems={[
                'Store name',
                'Store description',
                'Products and product images',
                'Categories and collections',
                'Public reviews and ratings',
                'Any social links you choose to add',
                'Whether your store is Verified',
              ]}
              privateTitle="Never public"
              privateItems={[
                'Email address',
                'Password',
                'Phone number (private — unless you add a WhatsApp contact link, in which case buyers can use it to message you directly on WhatsApp)',
                'Login history and session data',
                'Internal analytics',
                'Device information',
              ]}
            />
            <p className="italic text-zinc-500 font-semibold text-[11px] mt-2">
              If it&apos;s not in the &quot;visible to everyone&quot; list, it stays private by default.
            </p>
          </PrivacySection>

          {/* Section 4: Marketplace Transparency */}
          <PrivacySection id="marketplace-transparency" title="4. Marketplace Transparency">
            <p>
              Buyers can discover your storefront using information you choose to publish — your store name, 
              product titles, categories, descriptions, collections, and any public social links.
            </p>
            <p>
              Your private account information — including your email, password, and device data — is never 
              used for marketplace discovery or search ranking.
            </p>
            <p>
              Seyon does not host in-platform messaging. If you choose to add a WhatsApp contact link to your 
              storefront, buyers who tap it are taken directly to WhatsApp to contact you. That conversation 
              happens on WhatsApp, not on Seyon — we don&apos;t have access to its content, and it&apos;s governed by 
              WhatsApp&apos;s own privacy policy, not this one.
            </p>
            <p>
              Some stores display a Verified badge, indicating Seyon has confirmed the seller&apos;s identity. 
              Verification confirms identity only — it does not guarantee the outcome of any transaction. See 
              our Terms of Service and in-app buying guidance for recommended precautions before paying in advance.
            </p>
          </PrivacySection>

          {/* Section 5: Cookies & Analytics */}
          <PrivacySection id="cookies-and-analytics" title="5. Cookies & Analytics">
            <p>
              We use cookies to keep Seyon working and to understand how it&apos;s used.
            </p>
            <ul className="list-disc pl-4 space-y-2 text-zinc-600 mt-2">
              <li>
                <strong>Essential cookies</strong> — required to keep you logged in and Seyon functioning. These can&apos;t be turned off.
              </li>
              <li>
                <strong>Analytics cookies</strong> — help us understand how Seyon is used so we can improve it.
              </li>
              <li>
                <strong>Preference cookies</strong> — remember settings like display options.
              </li>
            </ul>
            <p className="mt-4">
              You can manage non-essential cookies through your browser settings. Turning off essential cookies 
              may prevent parts of Seyon from working correctly.
            </p>
          </PrivacySection>

          {/* Section 6: Data Sharing */}
          <PrivacySection id="data-sharing" title="6. Data Sharing">
            <p>
              We share information only with providers that help us run Seyon — never for advertising or resale 
              to third parties. This includes:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-600 my-3">
              <li>Cloud hosting and infrastructure providers</li>
              <li>Content delivery network (CDN) providers</li>
              <li>Analytics providers</li>
              <li>Payment processing providers</li>
              <li>Email delivery services</li>
            </ul>
            <p>
              We require these providers to protect your information in accordance with applicable law and 
              contractual data protection obligations. We do not sell your personal information.
            </p>
            <p>
              If any of these providers are located outside India, we take steps to ensure your information 
              continues to receive an appropriate level of protection, consistent with the Digital Personal Data 
              Protection Act, 2023.
            </p>
            <p className="italic text-zinc-500 font-semibold text-[11px] border-l-2 border-zinc-200 pl-3">
              *[To be completed by Engineering/Legal before or shortly after launch: replace the categories above with named subprocessors, and confirm which, if any, are located outside India.]*
            </p>
          </PrivacySection>

          {/* Section 7: Data Retention */}
          <PrivacySection id="data-retention" title="7. Data Retention">
            <p>
              We keep your information only as long as necessary for the purposes described in this policy.
            </p>
            <PrivacyTable
              headers={['Information', 'Retention']}
              rows={[
                ['Account data', 'Until you delete your account, plus a limited grace period to allow for recovery'],
                ['Security and audit logs', 'Up to 90 days'],
                ['Analytics data', 'Aggregated and anonymized after 12 months'],
                ['Backups', 'Rolling 30-day retention'],
              ]}
            />
            <p>
              We may retain certain information for longer where required for legal, regulatory, fraud-prevention, 
              tax, or security purposes, even after you delete your account.
            </p>
            <p className="italic text-zinc-500 font-semibold text-[11px] border-l-2 border-zinc-200 pl-3 mt-4">
              *[These figures are working defaults for launch. Engineering should confirm they match actual system behavior, and update this table if they don&apos;t.]*
            </p>
          </PrivacySection>

          {/* Section 8: Security */}
          <PrivacySection id="security" title="8. Security">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">How we protect your information</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>HTTPS encryption in transit</li>
                  <li>Encrypted, hashed password storage</li>
                  <li>Access controls limiting who can view account data internally</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">How we protect our platform</h3>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Monitoring for suspicious activity</li>
                  <li>Regular backups</li>
                  <li>Ongoing security reviews as Seyon grows</li>
                </ul>
              </div>
              <p className="pt-2">
                No method of storage or transmission is 100% secure, but we work to protect your information 
                using practices appropriate to the sensitivity of the data involved.
              </p>
            </div>
          </PrivacySection>

          {/* Section 9: Your Choices */}
          <PrivacySection id="your-choices" title="9. Your Choices">
            <p>
              These are controls built into Seyon itself — separate from the legal rights described below.
            </p>
            <p className="font-bold text-zinc-950 text-xs mt-2">
              As a creator, you can:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-600">
              <li>Publish or unpublish your storefront</li>
              <li>Add or remove products at any time</li>
              <li>Update your store description and branding</li>
              <li>Add or remove your WhatsApp contact link and other social links</li>
              <li>Close your account whenever you choose</li>
            </ul>
          </PrivacySection>

          {/* Section 10: Your Rights */}
          <PrivacySection id="your-rights" title="10. Your Rights">
            <p>
              We respect your rights under applicable privacy laws, including the Digital Personal Data Protection 
              Act, 2023 (India).
            </p>
            <p>
              Depending on your use of Seyon, you may have the right to:
            </p>

            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Access your information</h3>
                <p className="text-zinc-600">
                  Request a copy of the personal information associated with your Seyon account.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Correct inaccurate information</h3>
                <p className="text-zinc-600">
                  Update your account information yourself, or request assistance from our support team.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Withdraw consent</h3>
                <p className="text-zinc-600">
                  Where we rely on your consent to process your information, you may withdraw it at any time. This may 
                  affect your ability to use certain features.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Delete your account</h3>
                <p className="text-zinc-600">
                  Request deletion of your account. Once approved, we delete or anonymize your personal information, 
                  except where we&apos;re required to retain certain data for legal, regulatory, fraud-prevention, or 
                  security purposes.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Nominate a representative</h3>
                <p className="text-zinc-600">
                  Nominate another individual to exercise these rights on your behalf in the event of your death or incapacity.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-0.5">Raise a concern</h3>
                <p className="text-zinc-600">
                  Contact our Grievance Officer with any questions about how we handle your information. If your concern 
                  isn&apos;t resolved satisfactorily, you may have further remedies available under applicable law.
                </p>
              </div>
            </div>

            <p className="mt-4">
              To exercise any of these rights, contact us at <a href="mailto:privacy@seyon.in" className="text-[#A77F3A] hover:underline font-bold">privacy@seyon.in</a>.
            </p>

            <blockquote className="border-l-2 border-amber-500 bg-[#FCFAF7] p-3 text-[11px] font-semibold text-zinc-700 italic rounded-r-lg mt-4">
              Under the Digital Personal Data Protection Act, 2023, you are referred to as the <strong>Data Principal</strong>, and Seyon acts as the <strong>Data Fiduciary</strong> when processing your personal information.
            </blockquote>
          </PrivacySection>

          {/* Section 11: Children's Privacy */}
          <PrivacySection id="childrens-privacy" title="11. Children's Privacy">
            <p>
              Seyon is not directed at, and is not intended for use by, anyone under the age of 18. We do not knowingly 
              collect personal information from anyone under 18.
            </p>
            <p>
              If we become aware that we have collected personal information from someone under 18 without appropriate 
              consent, we will take steps to delete that information promptly. If you believe a child under 18 has 
              provided us with personal information, please contact us at <a href="mailto:privacy@seyon.in" className="text-[#A77F3A] hover:underline font-bold">privacy@seyon.in</a>.
            </p>
            <p className="italic text-zinc-500 font-semibold text-[11px] border-l-2 border-zinc-200 pl-3">
              *[Update this section if Seyon later supports a lower minimum age with verifiable parental consent — this is the safe default for launch.]*
            </p>
          </PrivacySection>

          {/* Section 12: Changes to This Policy */}
          <PrivacySection id="changes-to-this-policy" title="12. Changes to This Policy">
            <p>
              If we make significant changes to this policy, we&apos;ll notify you by email or through a notice on Seyon. 
              Minor editorial changes will simply update the &quot;Last updated&quot; date above. We encourage you to review 
              this policy periodically.
            </p>
          </PrivacySection>

          {/* Section 13: Contact & Grievance Officer */}
          <PrivacySection id="contact-and-grievance-officer" title="13. Contact & Grievance Officer">
            <div className="space-y-4">
              <div>
                <p className="font-semibold">
                  Privacy questions:{' '}
                  <a href="mailto:privacy@seyon.in" className="text-[#A77F3A] hover:underline font-bold">
                    privacy@seyon.in
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-bold text-zinc-950 text-xs mb-1">Grievance Officer:</h3>
                <ul className="list-none space-y-1 text-zinc-600 pl-0">
                  <li>[Name]</li>
                  <li>[Designation]</li>
                  <li>Email: [Email — e.g. grievance@seyon.in]</li>
                  <li>[Postal address, if required]</li>
                </ul>
                <p className="italic text-zinc-500 font-semibold text-[11px] border-l-2 border-zinc-200 pl-3 mt-2">
                  *[Required under the DPDP Act, 2023: a Grievance Officer must be a named individual, not just a role inbox, before this policy is published.]*
                </p>
              </div>

              <div>
                <p className="font-semibold">
                  General support:{' '}
                  <a href="mailto:support@seyon.in" className="text-[#A77F3A] hover:underline font-bold">
                    support@seyon.in
                  </a>
                </p>
              </div>
            </div>

            <p className="italic text-zinc-500 font-semibold text-[11px] border-t border-zinc-200/60 pt-4 mt-6">
              *This policy is written to be clear and specific to how Seyon actually works today. It should be reviewed by qualified legal counsel familiar with the Digital Personal Data Protection Act, 2023 before publication, particularly the Data Sharing, Data Retention, and Grievance Officer sections marked above.*
            </p>
          </PrivacySection>

          {/* Mobile contact card display (only visible on mobile/tablet at the end of the text) */}
          <div className="lg:hidden mt-8">
            <PrivacyContactCard email="privacy@seyon.in" />
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
