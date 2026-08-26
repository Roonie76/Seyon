import { AtSign } from 'lucide-react';

/**
 * The follow card.
 *
 * This panel used to render ten hardcoded Unsplash photographs as though they
 * were a live feed, above a link to instagram.com rather than to any account.
 * On a marketplace with no catalogue it was the most convincing thing on the
 * page, and none of it was real.
 *
 * Until there is a feed integration, the honest version is a link to an
 * account that exists. With no handle configured the panel does not render at
 * all -- a missing section is better than a fictional one.
 */
export function Instagram() {
  const handle = (process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || '').trim().replace(/^@/, '');
  if (!handle) return null;

  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        Follow Along
      </h4>

      <a
        href={`https://instagram.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-2xl border border-zinc-900 bg-[#0f0f0f] p-5 transition-all duration-500 hover:border-[#D4AF37]/30"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 text-[#D4AF37] transition-colors group-hover:border-[#D4AF37]/40">
          <AtSign size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-white tracking-wide">@{handle}</span>
          <span className="block text-xs text-zinc-500 font-light">
            Stories, new stores and behind the counter
          </span>
        </span>
      </a>
    </div>
  );
}
