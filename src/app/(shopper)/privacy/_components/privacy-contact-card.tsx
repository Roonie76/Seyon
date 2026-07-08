import * as React from 'react';
import { ArrowRight, Mail } from 'lucide-react';

interface PrivacyContactCardProps {
  email: string;
}

export function PrivacyContactCard({ email }: PrivacyContactCardProps) {
  return (
    <div className="w-full border border-[#E9DED0] rounded-2xl bg-[#FCFAF7] p-5 mt-8 shadow-3xs select-none print:hidden">
      <h3 className="font-serif text-sm font-black text-zinc-950 mb-2">
        Questions?
      </h3>
      <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed mb-4">
        If anything in this policy is unclear, email us.
      </p>
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center justify-between w-full text-xs font-bold text-[#A77F3A] hover:text-[#916b2f] transition-all group focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md outline-none"
      >
        <span className="flex items-center gap-1.5">
          <Mail className="h-4 w-4 stroke-[1.8]" aria-hidden="true" />
          {email}
        </span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

export default PrivacyContactCard;
