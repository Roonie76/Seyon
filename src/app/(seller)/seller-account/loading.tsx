import * as React from 'react';

export default function AccountLoading() {
  return (
    <section className="min-h-[calc(100vh-4rem)] bg-secondary py-10 px-4 sm:px-6">
      <div className="w-full max-w-2xl mx-auto animate-pulse">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-4 bg-zinc-800 rounded w-64" />
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm shadow-xl overflow-hidden">
          {/* Avatar Section */}
          <div className="relative bg-gradient-to-br from-zinc-800/50 via-zinc-900 to-zinc-950 px-6 py-8 flex flex-col items-center border-b border-zinc-800">
            <div className="h-24 w-24 rounded-full bg-zinc-800 border-2 border-zinc-700" />
            <div className="h-6 bg-zinc-850 rounded w-32 mt-3" />
            <div className="h-5 bg-zinc-900 rounded w-20 mt-1.5" />
          </div>

          {/* Fields Section */}
          <div className="px-6 py-6 space-y-5">
            {/* Field 1 */}
            <div className="space-y-2">
              <div className="h-3.5 bg-zinc-800 rounded w-28" />
              <div className="h-10 bg-zinc-800/50 rounded-lg w-full" />
            </div>
            {/* Field 2 */}
            <div className="space-y-2">
              <div className="h-3.5 bg-zinc-800 rounded w-20" />
              <div className="h-10 bg-zinc-800/50 rounded-lg w-full" />
            </div>
            {/* Field 3 */}
            <div className="space-y-2">
              <div className="h-3.5 bg-zinc-800 rounded w-32" />
              <div className="h-10 bg-zinc-800/50 rounded-lg w-full" />
            </div>
            {/* Field 4 */}
            <div className="space-y-2">
              <div className="h-3.5 bg-zinc-800 rounded w-28" />
              <div className="h-10 bg-zinc-800/50 rounded-lg w-full" />
            </div>
          </div>

          {/* Save Button */}
          <div className="px-6 pb-6">
            <div className="h-12 bg-zinc-800 rounded-lg w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
