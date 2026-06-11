import Link from 'next/link';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface ChecklistInput {
  hasLogo: boolean;
  whatsappVerified: boolean;
  productCount: number;
  hasLocation: boolean;
}

interface ChecklistItem {
  label: string;
  done: boolean;
  hint: string;
  href: string;
}

export function OnboardingChecklist({ hasLogo, whatsappVerified, productCount, hasLocation }: ChecklistInput) {
  const items: ChecklistItem[] = [
    {
      label: 'Add your shop logo',
      done: hasLogo,
      hint: 'Stores with a logo look trustworthy and get more taps.',
      href: '/dashboard#settings',
    },
    {
      label: 'Verify your WhatsApp number',
      done: whatsappVerified,
      hint: 'Verified sellers earn a trust badge buyers can see.',
      href: '/dashboard#settings',
    },
    {
      label: `List at least 3 products (${Math.min(productCount, 3)}/3)`,
      done: productCount >= 3,
      hint: 'Stores with 3+ products keep buyers browsing.',
      href: '/dashboard/products',
    },
    {
      label: 'Set your city & delivery info',
      done: hasLocation,
      hint: 'Buyers check where you ship from before they message.',
      href: '/dashboard#settings',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null; // fully onboarded — stay out of the way

  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <Card className="glass border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Rocket className="h-4 w-4 text-amber-600" /> Get your store noticed
        </CardTitle>
        <CardDescription className="text-xs">
          {doneCount} of {items.length} steps done — finish setup to attract more buyers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div
          className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Store setup progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-start gap-2.5 rounded-lg p-2 -m-1 transition-colors ${
                  item.done ? 'opacity-60' : 'hover:bg-amber-500/5'
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 text-zinc-300 shrink-0 mt-0.5" />
                )}
                <span>
                  <span className={`text-sm font-semibold block ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.label}
                  </span>
                  {!item.done && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
