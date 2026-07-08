
interface PrivacyHeroProps {
  title?: string;
  subtitle?: string;
  lastUpdated: string;
  readingTime: string;
}

export function PrivacyHero({ 
  title = "Privacy Policy", 
  subtitle = "Your privacy matters. This page explains what information we collect, why we collect it, and how we protect it — in clear, straightforward language.", 
  lastUpdated, 
  readingTime 
}: PrivacyHeroProps) {
  return (
    <div className="border-b border-zinc-200 pb-6 mb-8 select-none">
      <div className="mb-4">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight font-serif">
          {title}
        </h1>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl font-serif italic">
        {subtitle}
      </p>
      <div className="flex items-center gap-1.5 mt-4 text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">
        <span>Last updated: {lastUpdated}</span>
        <span>•</span>
        <span>Estimated reading time: {readingTime}</span>
      </div>
    </div>
  );
}

export default PrivacyHero;
