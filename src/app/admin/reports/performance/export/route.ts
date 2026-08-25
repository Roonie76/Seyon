import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getSlaPerformance } from '@/backend/actions/sla-performance';
import { toCsv } from '@/shared/lib/sla-performance';

/**
 * The same figures, as a file.
 *
 * A route rather than client-side generation, so the export is the report
 * rather than a second implementation of it that can quietly disagree with what
 * is on screen.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  const months = new URL(request.url).searchParams.get('months') ?? undefined;
  const res = await getSlaPerformance({ months });
  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const stamp = res.data.generatedAt.toISOString().slice(0, 10);

  return new NextResponse(toCsv(res.data.months), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="seyon-complaint-performance-${stamp}.csv"`,
      // A compliance figure that arrived from a cache is not a figure.
      'Cache-Control': 'no-store',
    },
  });
}
