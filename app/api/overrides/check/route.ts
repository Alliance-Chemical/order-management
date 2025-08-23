import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { overrideId } = body;
    
    const key = `override:${overrideId}`;
    const override = await kv.hgetall<Record<string, any>>(key);
    
    if (!override || !override.approved) {
      return NextResponse.json({ valid: false });
    }
    
    // Check expiry
    if ((override.expiresAt ?? 0) < Date.now()) {
      await kv.del(key);
      return NextResponse.json({ valid: false });
    }
    
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error checking override:', error);
    return NextResponse.json({ valid: false });
  }
}