import { NextResponse } from 'next/server';
import { ensureCoreFreightSchema } from '@/lib/db/ensure-schema';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await ensureCoreFreightSchema();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('DB ensure failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

