import * as React from 'react';
import { Eye, ShieldAlert } from 'lucide-react';

interface PrivacyComparisonProps {
  visibleTitle: string;
  visibleItems: string[];
  privateTitle: string;
  privateItems: string[];
}

export function PrivacyComparison({
  visibleTitle,
  visibleItems,
  privateTitle,
  privateItems,
}: PrivacyComparisonProps) {
  return (
    <div className="w-full border border-zinc-200 rounded-xl overflow-hidden shadow-2xs my-4 bg-white grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-250 text-xs">
      {/* Visible to everyone */}
      <div className="p-5 flex flex-col gap-4">
        <h3 className="font-bold text-zinc-950 flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          {visibleTitle}
        </h3>
        <ul className="space-y-2 text-zinc-600 font-medium">
          {visibleItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-emerald-500 font-extrabold select-none">•</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Private Information */}
      <div className="p-5 flex flex-col gap-4">
        <h3 className="font-bold text-zinc-950 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" aria-hidden="true" />
          {privateTitle}
        </h3>
        <ul className="space-y-2 text-zinc-600 font-medium">
          {privateItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-rose-500 font-extrabold select-none">•</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default PrivacyComparison;
