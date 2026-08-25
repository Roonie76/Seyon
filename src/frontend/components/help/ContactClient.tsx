'use client';

import { LEGAL_CONTACTS } from '@/shared/data/legal-entity';
import * as React from 'react';
import Link from 'next/link';
import { Mail, Clock, MessageSquare, Check, Headphones, X } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface ContactClientProps {
  isLoggedIn: boolean;
}

export function ContactClient({ isLoggedIn }: ContactClientProps) {
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  // One source, so the address in the legal pages and the address on the
  // contact page cannot drift apart again.
  const supportEmail = LEGAL_CONTACTS.support;
  const emailSubject = 'Support Request';
  const emailBody = `Hello Seyon Team,

Name:

WhatsApp Number:

Issue:




Store / Product Link (optional):
Images of issue (optional):


Regards,`;

  const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  const handleEmailClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1A1A18] font-sans relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20 relative z-10">
        
        {/* Back Button */}
        <div className="mb-10">
          <BackButton fallbackHref="/marketplace" label="Go Back" className="text-[#6F6A63] hover:text-[#B88A2E]" />
        </div>

        {/* Two-Column Editorial Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Timeline Steps */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#B88A2E] tracking-widest block">
                CONTACT US
              </span>
              <h1 className="text-3xl md:text-5xl font-normal text-[#1A1A18] tracking-tight font-serif leading-tight">
                We make support<br />simple and fast
              </h1>
            </div>

            {/* Timeline Steps Block */}
            <div className="relative pl-6 space-y-8">
              {/* Vertical connecting line */}
              <div className="absolute left-11 top-4 bottom-4 w-[1px] bg-[#ECE5D9] z-0" />

              {/* Step 1 */}
              <div className="flex gap-6 relative z-10 items-start">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <Mail className="h-4.5 w-4.5 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#1A1A18] font-serif">Send your email</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed">
                    Reach out to us at <a onClick={handleEmailClick} href={mailtoUrl} className="font-medium text-[#1A1A18] hover:text-[#B88A2E] transition-colors">{supportEmail}</a>
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6 relative z-10 items-start">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <Clock className="h-4.5 w-4.5 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#1A1A18] font-serif">We review it</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed">
                    Our team carefully looks into your query
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6 relative z-10 items-start">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <MessageSquare className="h-4.5 w-4.5 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#1A1A18] font-serif">We reply within 24 hours</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed">
                    You&apos;ll hear back from us with a solution
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-6 relative z-10 items-start">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <Check className="h-4.5 w-4.5 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#1A1A18] font-serif">Issue resolved</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed">
                    We&apos;re here until you&apos;re satisfied
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Action Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-[360px] bg-[#FFFEFC] border border-[#ECE5D9] rounded-[24px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] text-center flex flex-col items-center gap-6">
              
              <div className="h-14 w-14 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E]">
                <Mail className="h-6 w-6 stroke-[1.5]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-normal text-[#1A1A18] font-serif">Email Us</h2>
                <a
                  onClick={handleEmailClick}
                  href={mailtoUrl}
                  className="text-xs font-semibold text-[#B88A2E] hover:text-[#C69A42] transition-colors break-all"
                >
                  {supportEmail}
                </a>
              </div>

              {/* Editorial Divider */}
              <div className="w-full flex items-center justify-center gap-2">
                <div className="h-[1px] bg-[#ECE5D9] flex-1" />
                <div className="h-1 w-1 bg-[#B88A2E] rotate-45" />
                <div className="h-[1px] bg-[#ECE5D9] flex-1" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[#6F6A63] font-semibold uppercase tracking-wider block">
                  Average response
                </span>
                <p className="text-sm font-bold text-[#1A1A18]">
                  Within 24 Hours
                </p>
                <span className="text-[10px] text-[#6F6A63] font-medium block">
                  (Mon–Sat)
                </span>
              </div>

              <a
                onClick={handleEmailClick}
                href={mailtoUrl}
                className="w-full bg-[#1A1A18] hover:bg-[#2C2C29] text-[#FFFEFC] rounded-xl py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                Send an Email &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Footer section: Stay Connected */}
        <div className="border-t border-[#ECE5D9] mt-20 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
          <span className="text-xs font-semibold text-[#6F6A63]/60 uppercase tracking-widest font-sans">
            Stay connected
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="https://instagram.com/seyon.store" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#6F6A63] hover:text-[#B88A2E] transition-colors">
              <InstagramIcon className="stroke-[1.5]" />
              <span className="text-xs font-semibold">@seyon.store</span>
            </a>
            <a href="https://x.com/seyonstore" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#6F6A63] hover:text-[#1A1A18] transition-colors">
              <XIcon />
              <span className="text-xs font-semibold">@seyonstore</span>
            </a>
            <a href="https://linkedin.com/company/seyon" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#6F6A63] hover:text-sky-750 transition-colors">
              <LinkedInIcon className="stroke-[1.5]" />
              <span className="text-xs font-semibold">Seyon</span>
            </a>
          </div>
        </div>

      </div>

      {/* Premium Login Required Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FFFEFC] border border-[#ECE5D9] rounded-[24px] max-w-sm w-full p-6 shadow-2xl space-y-6 relative animate-scale-up">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-[#6F6A63] hover:text-[#1A1A18] transition-colors"
              type="button"
            >
              <X className="h-5 w-5 stroke-[1.5]" />
            </button>

            <div className="text-center space-y-3 pt-2">
              <div className="h-12 w-12 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] mx-auto">
                <Headphones className="h-6 w-6 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A18] font-serif">
                Login Required
              </h3>
              <p className="text-xs text-[#6F6A63] leading-relaxed">
                To send an email to Seyon Store Support, you must be logged in first.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/login?callbackUrl=/contact"
                className="w-full bg-[#1A1A18] hover:bg-[#2C2C29] text-[#FFFEFC] rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-center transition-all duration-200"
              >
                Log In First
              </Link>
              <button
                onClick={() => setShowLoginModal(false)}
                className="w-full bg-transparent border border-[#ECE5D9] hover:bg-[#FAF8F4] text-[#6F6A63] rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-center transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
