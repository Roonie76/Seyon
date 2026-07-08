import * as React from 'react';

interface PrivacySectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

export function PrivacySection({ id, title, children }: PrivacySectionProps) {
  return (
    <section
      id={id}
      tabIndex={-1}
      className="scroll-mt-24 py-6 border-b border-zinc-150/60 last:border-b-0 outline-none space-y-4"
    >
      <h2 className="text-xl font-bold text-zinc-950 font-serif leading-tight">
        {title}
      </h2>
      <div className="text-xs text-zinc-600 font-medium leading-relaxed space-y-4">
        {children}
      </div>
    </section>
  );
}

export default PrivacySection;
