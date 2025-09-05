import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { productFreightLinks } from '@/lib/db/schema/freight';
import { inArray } from 'drizzle-orm';
import { KVCache } from '@/lib/cache/kv-cache';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

// POST /api/product-links/approve - Batch approve links
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
    }
    const approvedBy: string = body?.approvedBy || 'api/product-links/approve';

    const result = await withEdgeRetry(async () => {
      const updated = await db
        .update(productFreightLinks)
        .set({
          isApproved: true,
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(productFreightLinks.id, ids))
        .returning({ id: productFreightLinks.id });

      return { updatedCount: updated.length, updatedIds: updated.map(u => u.id) };
    });

    await KVCache.deletePattern('product-links:*');
    await KVCache.deletePattern('unlinked-products:*');

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Batch approve error:', error);
    return NextResponse.json({ error: 'Failed to approve links' }, { status: 500 });
  }
}

