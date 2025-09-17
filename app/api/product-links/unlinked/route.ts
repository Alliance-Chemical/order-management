import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { productFreightLinks, products } from '@/lib/db/schema/freight';
import { eq, and, isNull } from 'drizzle-orm';
import { KVCache } from '@/lib/cache/kv-cache';

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

// GET /api/product-links/unlinked - Get products without approved classifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hazardous = searchParams.get('hazardous');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const cacheKey = `unlinked-products:${hazardous}:${limit}:${offset}`;
    
    // Try cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    const result = await withEdgeRetry(async () => {
      // Get products that don't have approved links
      const query = db
        .select({
          productId: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          isHazardous: products.isHazardous,
          casNumber: products.casNumber,
          unNumber: products.unNumber,
          packagingType: products.packagingType,
          unitContainerType: products.unitContainerType,
          weight: products.weight,
          length: products.length,
          width: products.width,
          height: products.height,
        })
        .from(products)
        .leftJoin(
          productFreightLinks,
          and(
            eq(products.id, productFreightLinks.productId),
            eq(productFreightLinks.isApproved, true)
          )
        );
      
      // Build conditions
      const conditions = [
        eq(products.isActive, true),
        isNull(productFreightLinks.id) // No approved links
      ];
      
      if (hazardous === 'true') {
        conditions.push(eq(products.isHazardous, true));
      } else if (hazardous === 'false') {
        conditions.push(eq(products.isHazardous, false));
      }
      
      const unlinkedProducts = await query
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .execute();
      
      return unlinkedProducts;
    });
    
    // Cache for 2 minutes (changes frequently as links are created)
    await KVCache.set(cacheKey, result, 120);
    
    return NextResponse.json({
      products: result,
      totalCount: result.length,
      hasMore: result.length === limit,
      hazardousProducts: result.filter(p => p.isHazardous).length,
      nonHazardousProducts: result.filter(p => !p.isHazardous).length,
    });
    
  } catch (error) {
    console.error('Error fetching unlinked products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unlinked products' },
      { status: 500 }
    );
  }
}
