import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { generateProductBarcode } from '@/lib/sales-server';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'changePrices');
  if ('error' in auth) return auth.error;

  try {
    const barcode = await generateProductBarcode();
    return NextResponse.json({ barcode });
  } catch (error) {
    console.error('Generate barcode error:', error);
    return NextResponse.json({ error: 'Failed to generate barcode' }, { status: 500 });
  }
}
