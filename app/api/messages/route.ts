import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  countNewContactMessages,
  listContactMessages,
} from '@/lib/messages-server';
import type { ContactMessageStatus } from '@/lib/erp-types';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'viewMessages');
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') ?? 'all') as
      | ContactMessageStatus
      | 'all';
    const wantCount = searchParams.get('count') === 'new';

    if (wantCount) {
      const count = await countNewContactMessages();
      return NextResponse.json({ count });
    }

    const messages = await listContactMessages({ status });
    const newCount = await countNewContactMessages();
    return NextResponse.json({ messages, newCount });
  } catch (error) {
    console.error('List messages error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}
