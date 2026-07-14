import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { getReportSummary } from '@/lib/reports-server';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'viewReports');
  if ('error' in auth) return auth.error;

  try {
    const period = (request.nextUrl.searchParams.get('period') ?? 'month') as
      | 'day'
      | 'week'
      | 'month';
    const summary = await getReportSummary(period);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Report summary error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
