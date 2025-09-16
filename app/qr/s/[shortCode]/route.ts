import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedDb } from '@/lib/db/neon';
import { qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  try {
    const code = params.shortCode;
    const db = getOptimizedDb();

    const qr = await db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, code)
    });

    const origin = request.nextUrl.origin;

    if (!qr) {
      const url = new URL('/404', origin);
      return NextResponse.redirect(url);
    }

    const url = new URL(`/workspace/${qr.orderId}`, origin);
    url.searchParams.set('sc', code);
    return NextResponse.redirect(url);
  } catch (err) {
    const origin = request.nextUrl.origin;
    const url = new URL('/', origin);
    return NextResponse.redirect(url);
  }
}

