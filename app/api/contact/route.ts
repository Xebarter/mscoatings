import { NextRequest, NextResponse } from 'next/server';
import {
  createContactMessage,
  validateContactPayload,
} from '@/lib/messages-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateContactPayload(body);
    if (!validated.ok) {
      const status = validated.error === 'Rejected' ? 204 : 400;
      if (status === 204) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json({ error: validated.error }, { status });
    }

    const id = await createContactMessage(validated.data);
    return NextResponse.json(
      {
        id,
        ok: true,
        message: 'Thank you — your message was received. We will get back to you soon.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Unable to send your message right now. Please try again or call us.' },
      { status: 500 }
    );
  }
}
