import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function resolveAllowOrigin(origin: string | null): string {
  if (!origin || origin === 'null') return '*';
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.includes('mscoatings.shop')
  ) {
    return origin;
  }
  return 'https://www.mscoatings.shop';
}

function withCors(request: NextRequest, response: NextResponse) {
  const allowOrigin = resolveAllowOrigin(request.headers.get('origin'));
  response.headers.set('Access-Control-Allow-Origin', allowOrigin);
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type'
  );
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/** Enable desktop Electron (and localhost) to call /api/* with Bearer tokens. */
export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return withCors(request, new NextResponse(null, { status: 204 }));
  }

  return withCors(request, NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
