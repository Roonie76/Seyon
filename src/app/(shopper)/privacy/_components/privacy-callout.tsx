import * as React from 'react';
import { Info, Lock } from 'lucide-react';

interface PrivacyCalloutProps {
  type: 'info' | 'lock' | 'glance';
  title?: string;
  items?: string[];
  children?: React.ReactNode;
}

export function PrivacyCallout({ type, title, items, children }: PrivacyCalloutProps) {
  if (type === 'glance') {
    return (
      <div className="w-full border border-[#E9DED0] rounded-2xl bg-[#FCFAF7]/60 p-6 my-6 shadow-3xs relative overflow-hidden">
        {title && (
          <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-4 font-serif">
            {title}
          </h2>
        )}
        {items && items.length > 0 && (
          <ul className="space-y-2.5 text-xs text-zinc-700 font-medium">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-[#A77F3A] font-extrabold select-none">•</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="text-[11px] text-zinc-500 font-semibold mt-4 border-t border-zinc-200/60 pt-3 select-none italic">
          This summary is provided for convenience. The full policy below is the document that governs how your information is handled.
        </div>
      </div>
    );
  }

  if (type === 'lock') {
    return (
      <div className="w-full border border-emerald-500/10 rounded-xl bg-emerald-500/5 p-4 my-5 flex items-start gap-3 text-xs text-emerald-800">
        <Lock className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
        <div className="leading-relaxed font-semibold">{children}</div>
      </div>
    );
  }

  return (
    <div className="w-full border border-blue-500/10 rounded-xl bg-blue-500/5 p-4 my-5 flex items-start gap-3 text-xs text-blue-800">
      <Info className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" aria-hidden="true" />
      <div className="leading-relaxed font-semibold">{children}</div>
    </div>
  );
}

export default PrivacyCallout;
