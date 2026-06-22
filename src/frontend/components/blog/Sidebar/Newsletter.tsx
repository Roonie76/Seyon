'use client';

import { useState } from 'react';
import { Mail, Check } from 'lucide-react';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate API request
    setTimeout(() => {
      setLoading(false);
      setSubscribed(true);
      setEmail('');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        Newsletter
      </h4>

      <div className="rounded-2xl border border-zinc-900 bg-[#0f0f0f] p-6 space-y-4">
        <p className="text-xs text-[#b5b5b5] font-light leading-relaxed">
          Subscribe to receive editorial stories, capsule collection previews, and exclusive brand insights.
        </p>

        {subscribed ? (
          <div className="flex items-center gap-2 text-xs text-[#D4AF37] bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-3 rounded-sm font-semibold">
            <Check size={14} /> Thank you for subscribing!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="YOUR EMAIL ADDRESS"
                className="w-full bg-black text-[10px] font-bold tracking-[0.1em] text-white placeholder:text-zinc-600 px-4 py-3.5 pr-10 rounded-sm border border-zinc-900 focus:outline-none focus:border-[#D4AF37] transition-colors duration-300"
              />
              <Mail size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-650" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center rounded-sm bg-[#D4AF37] text-black py-3 text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 hover:bg-[#E4C29D] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] disabled:opacity-50"
            >
              {loading ? 'SUBSCRIBING...' : 'SIGN UP NOW'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
