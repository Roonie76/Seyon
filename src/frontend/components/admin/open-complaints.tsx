import Link from 'next/link';
import { REPORT_CATEGORY_LABELS } from '@/shared/lib/complaints';
import type { ReportCategory } from '@prisma/client';

/**
 * A read-only summary of what is waiting, on the admin landing page.
 *
 * This replaces `AdminModeration`, which carried its own Resolve, Suspend and
 * Verify buttons written before the moderation work. Two consequences made it
 * worth deleting rather than repairing:
 *
 * Its Resolve button set `status = 'RESOLVED'` and nothing else, which the
 * `Report_terminal_has_resolved_at` constraint now rejects outright; and its
 * Suspend button called `suspendShopAction` without a reason, which that action
 * has refused since the audit pass. Both jobs are done properly on
 * /admin/reports and /admin/stores, with acknowledgement recorded, a resolution
 * note sent to the reporter, and an audit row written.
 *
 * Keeping a second set of controls that do the same thing worse is how an admin
 * ends up resolving a complaint without anyone being told what was decided. So
 * this page now shows the queue and links to the screen that acts on it.
 */

export interface OpenComplaintRow {
  id: string;
  category: ReportCategory;
  reason: string;
  createdAt: Date;
  overdue: boolean;
  shopName: string;
  shopSlug: string;
}

export function OpenComplaints({
  rows,
  total,
  overdueCount,
}: {
  rows: OpenComplaintRow[];
  total: number;
  overdueCount: number;
}) {
  return (
    <div className="rounded-xl border border-border p-5" data-testid="open-complaints">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Open complaints{' '}
          <span className="text-foreground" data-testid="open-complaint-total">
            ({total})
          </span>
        </h2>
        <Link
          href="/admin/reports"
          className="text-xs font-bold text-[#A77F3A] hover:underline"
          data-testid="open-complaints-link"
        >
          Go to complaints →
        </Link>
      </div>

      {overdueCount > 0 ? (
        <p
          data-testid="open-complaints-overdue"
          className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800"
        >
          {overdueCount} past the 48-hour acknowledgement deadline.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p data-testid="open-complaints-empty" className="text-xs text-muted-foreground">
          Nothing waiting.
        </p>
      ) : (
        <ul className="divide-y divide-border text-xs">
          {rows.map((r) => (
            <li key={r.id} className="py-2" data-testid="open-complaint-row">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-foreground">{REPORT_CATEGORY_LABELS[r.category]}</span>
                <span className="text-[10px] text-muted-foreground">
                  {r.createdAt.toLocaleDateString('en-IN')}
                  {r.overdue ? ' · overdue' : ''}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-muted-foreground">{r.reason}</p>
              <Link
                href={`/admin/stores/${r.shopSlug}`}
                className="text-[11px] font-bold text-[#A77F3A] hover:underline"
              >
                {r.shopName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
