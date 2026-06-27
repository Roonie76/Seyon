'use client';

import * as React from 'react';
import { ShieldAlert, Sparkles, XCircle, CheckCircle2 } from 'lucide-react';

export function WhySeyonTabs() {
  const [activeTab, setActiveTab] = React.useState<'social' | 'seyon'>('seyon');

  const socialItems = [
    'Scroll through hundreds of reels',
    'Check highlights & captions',
    'DM for price & details',
    'Wait for replies',
    'Lose it forever',
  ];

  const seyonItems = [
    'Search what you want',
    'Find verified creators',
    'View all products in one place',
    'DM to order instantly',
    'Easy, Fast, Reliable.',
  ];

  return (
    <div className="w-full">
      {/* Tab Switcher Headers */}
      <div className="flex bg-[#F5F2EB] p-1.5 rounded-full mb-6 w-full max-w-sm mx-auto border border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('social')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 cursor-pointer ${
            activeTab === 'social'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900 bg-transparent'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Social Media
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seyon')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 cursor-pointer ${
            activeTab === 'seyon'
              ? 'bg-[#A77F3A] text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900 bg-transparent'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Seyon
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="bg-[#FCFAF7] rounded-[24px] border border-[#E9DED0] p-6 max-w-md mx-auto shadow-2xs transition-all duration-300">
        <h4 className="font-serif text-sm font-bold text-zinc-900 mb-4 tracking-tight">
          {activeTab === 'social' ? (
            <span className="text-rose-600 flex items-center justify-center gap-1.5">
              Shopping on Social Media
            </span>
          ) : (
            <span className="text-[#A77F3A] flex items-center justify-center gap-1.5">
              Shopping on Seyon
            </span>
          )}
        </h4>

        <ul className="flex flex-col gap-3 text-xs text-zinc-700 font-medium w-fit mx-auto">
          {activeTab === 'social'
            ? socialItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 py-1 text-left animate-fade-in"
                >
                  <XCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-zinc-750">{item}</span>
                </li>
              ))
            : seyonItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 py-1 text-left animate-fade-in"
                >
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-zinc-750">{item}</span>
                </li>
              ))}
        </ul>
      </div>
    </div>
  );
}
