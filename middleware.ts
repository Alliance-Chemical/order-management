import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected API routes that require authentication
const protectedApiRoutes = [
  '/api/workspace',
  '/api/qr/generate',
  '/api/qr/print',
  '/api/documents',
  '/api/alerts',
  '/api/activity',
];

// Public API routes that don't require authentication
const publicApiRoutes = [
  '/api/qr/scan', // QR scanning should be public
  '/api/webhook', // Webhooks have their own auth
  '/api/health',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected API route
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));
  const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route));

  if (isProtectedApi && !isPublicApi) {
    // For development, skip API authentication
    // In production, uncomment the authentication checks below
    /*
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.API_SECRET_KEY;

    if (!apiKey || (expectedApiKey && apiKey !== expectedApiKey)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing bearer token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (!token || token.length < 10) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    */
  }

  // Check if this is a protected workspace page
  if (pathname.startsWith('/workspace/')) {
    // For development, auto-set session cookie if missing
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie) {
      // Set a dev session cookie
      const response = NextResponse.next();
      response.cookies.set('session', 'dev-session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/workspace/:path*',
  ],
};