import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { getEnterpriseReport } from '@/lib/reports/enterprise-server';
import type { DatePreset } from '@/lib/reports/date-range';

const VALID_PRESETS: DatePreset[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'thisMonth',
  'lastMonth',
  'quarter',
  'year',
  'custom',
];

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'viewReports');
  if ('error' in auth) return auth.error;

  try {
    const params = request.nextUrl.searchParams;
    const presetParam = (params.get('preset') ?? 'last30') as DatePreset;
    const preset = VALID_PRESETS.includes(presetParam) ? presetParam : 'last30';
    const from = params.get('from') ?? undefined;
    const to = params.get('to') ?? undefined;

    const report = await getEnterpriseReport(preset, from, to, {
      category: params.get('category') ?? undefined,
      productId: params.get('productId') ?? undefined,
      paymentMethod: params.get('paymentMethod') ?? undefined,
      channel: params.get('channel') ?? undefined,
      employee: params.get('employee') ?? undefined,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Enterprise report error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    const isConfigError =
      message.includes('FIREBASE_SERVICE_ACCOUNT') ||
      message.includes('Firebase Admin is not configured');
    return NextResponse.json(
      { error: message },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
