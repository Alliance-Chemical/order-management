import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { productFreightLinks, products, freightClassifications } from '@/lib/db/schema/freight';
import { eq, and, desc } from 'drizzle-orm';
import { KVCache } from '@/lib/cache/kv-cache';

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

// GET /api/product-links - Get product-classification linkages with details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const classificationId = searchParams.get('classificationId');
    const approved = searchParams.get('approved');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Create cache key
    const cacheKey = `product-links:${productId}:${classificationId}:${approved}:${limit}:${offset}`;
    
    // Try cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    const result = await withEdgeRetry(async () => {
      // Build the query with joins to get full details
      let query = db
        .select({
          linkId: productFreightLinks.id,
          productId: productFreightLinks.productId,
          classificationId: productFreightLinks.classificationId,
          overrideFreightClass: productFreightLinks.overrideFreightClass,
          overridePackaging: productFreightLinks.overridePackaging,
          confidenceScore: productFreightLinks.confidenceScore,
          linkSource: productFreightLinks.linkSource,
          isApproved: productFreightLinks.isApproved,
          approvedBy: productFreightLinks.approvedBy,
          approvedAt: productFreightLinks.approvedAt,
          createdAt: productFreightLinks.createdAt,
          createdBy: productFreightLinks.createdBy,
          updatedAt: productFreightLinks.updatedAt,
          
          // Product details
          productSku: products.sku,
          productName: products.name,
          productIsHazardous: products.isHazardous,
          productCasNumber: products.casNumber,
          productUnNumber: products.unNumber,
          
          // Classification details
          classificationDescription: freightClassifications.description,
          freightClass: freightClassifications.freightClass,
          nmfcCode: freightClassifications.nmfcCode,
          isHazmat: freightClassifications.isHazmat,
          hazmatClass: freightClassifications.hazmatClass,
          packingGroup: freightClassifications.packingGroup,
        })
        .from(productFreightLinks)
        .leftJoin(products, eq(productFreightLinks.productId, products.id))
        .leftJoin(freightClassifications, eq(productFreightLinks.classificationId, freightClassifications.id));
      
      // Apply filters
      const conditions = [];
      
      if (productId) {
        conditions.push(eq(productFreightLinks.productId, productId));
      }
      
      if (classificationId) {
        conditions.push(eq(productFreightLinks.classificationId, classificationId));
      }
      
      if (approved === 'true') {
        conditions.push(eq(productFreightLinks.isApproved, true));
      } else if (approved === 'false') {
        conditions.push(eq(productFreightLinks.isApproved, false));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const linksList = await query
        .orderBy(desc(productFreightLinks.createdAt))
        .limit(limit)
        .offset(offset)
        .execute();
      
      return linksList;
    });
    
    // Cache for 5 minutes
    await KVCache.set(cacheKey, result, 300);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching product links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product links' },
      { status: 500 }
    );
  }
}

// POST /api/product-links - Create new product-classification link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.productId || !body.classificationId) {
      return NextResponse.json(
        { error: 'Product ID and classification ID are required' },
        { status: 400 }
      );
    }
    
    // Check if link already exists
    const existingLink = await withEdgeRetry(async () => {
      const [existing] = await db
        .select()
        .from(productFreightLinks)
        .where(
          and(
            eq(productFreightLinks.productId, body.productId),
            eq(productFreightLinks.classificationId, body.classificationId)
          )
        )
        .limit(1);
      
      return existing;
    });
    
    if (existingLink) {
      return NextResponse.json(
        { error: 'Product-classification link already exists' },
        { status: 409 }
      );
    }
    
    // Validate product and classification exist
    const [product, classification] = await Promise.all([
      withEdgeRetry(async () => {
        const [p] = await db.select().from(products).where(eq(products.id, body.productId)).limit(1);
        return p;
      }),
      withEdgeRetry(async () => {
        const [c] = await db.select().from(freightClassifications).where(eq(freightClassifications.id, body.classificationId)).limit(1);
        return c;
      })
    ]);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    if (!classification) {
      return NextResponse.json(
        { error: 'Classification not found' },
        { status: 404 }
      );
    }
    
    // Safety check: Hazardous products require hazmat classifications
    if (product.isHazardous && !classification.isHazmat) {
      return NextResponse.json(
        { 
          error: 'Hazardous products must be linked to hazmat classifications',
          details: {
            productSku: product.sku,
            productIsHazardous: true,
            classificationIsHazmat: false
          }
        },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [newLink] = await db
        .insert(productFreightLinks)
        .values({
          productId: body.productId,
          classificationId: body.classificationId,
          overrideFreightClass: body.overrideFreightClass,
          overridePackaging: body.overridePackaging,
          confidenceScore: body.confidenceScore ? parseFloat(body.confidenceScore) : null,
          linkSource: body.linkSource || 'manual',
          isApproved: body.isApproved || false, // Default to unapproved for safety
          createdBy: body.createdBy,
        })
        .returning();
      
      return newLink;
    });
    
    // Clear cache
    await KVCache.deletePattern('product-links:*');
    await KVCache.deletePattern('unlinked-products:*');
    await KVCache.deletePattern('unlinked-products:*');
    
    return NextResponse.json(result, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating product link:', error);
    
    return NextResponse.json(
      { error: 'Failed to create product link' },
      { status: 500 }
    );
  }
}

// PUT /api/product-links - Update existing product link (especially for approval)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Link ID is required' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      // Only update provided fields
      if (body.overrideFreightClass !== undefined) updateData.overrideFreightClass = body.overrideFreightClass;
      if (body.overridePackaging !== undefined) updateData.overridePackaging = body.overridePackaging;
      if (body.confidenceScore !== undefined) updateData.confidenceScore = parseFloat(body.confidenceScore);
      if (body.linkSource !== undefined) updateData.linkSource = body.linkSource;
      if (body.isApproved !== undefined) updateData.isApproved = body.isApproved;
      if (body.approvedBy !== undefined) updateData.approvedBy = body.approvedBy;
      if (body.isApproved === true) updateData.approvedAt = new Date();
      
      const [updatedLink] = await db
        .update(productFreightLinks)
        .set(updateData)
        .where(eq(productFreightLinks.id, body.id))
        .returning();
      
      return updatedLink;
    });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Product link not found' },
        { status: 404 }
      );
    }
    
    // Clear cache
    await KVCache.deletePattern('product-links:*');
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error updating product link:', error);
    return NextResponse.json(
      { error: 'Failed to update product link' },
      { status: 500 }
    );
  }
}

// DELETE /api/product-links - Remove product-classification link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Link ID is required' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [deletedLink] = await db
        .delete(productFreightLinks)
        .where(eq(productFreightLinks.id, id))
        .returning();
      
      return deletedLink;
    });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Product link not found' },
        { status: 404 }
      );
    }
    
    // Clear cache
    await KVCache.deletePattern('product-links:*');
    await KVCache.deletePattern('unlinked-products:*');
    
    return NextResponse.json({ message: 'Product link removed successfully' });
    
  } catch (error) {
    console.error('Error deleting product link:', error);
    return NextResponse.json(
      { error: 'Failed to delete product link' },
      { status: 500 }
    );
  }
}

// GET /api/product-links/unlinked - Get products without approved classifications
async function getUnlinkedProducts() {
  const cacheKey = 'unlinked-products:all';
  
  // Try cache first
  const cached = await KVCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  const result = await withEdgeRetry(async () => {
    // Get products that don't have approved links
    const unlinkedProducts = await db
      .select({
        productId: products.id,
        sku: products.sku,
        name: products.name,
        isHazardous: products.isHazardous,
        casNumber: products.casNumber,
        unNumber: products.unNumber,
        packagingType: products.packagingType,
        unitContainerType: products.unitContainerType,
        hasUnapprovedLink: productFreightLinks.id,
      })
      .from(products)
      .leftJoin(
        productFreightLinks,
        and(
          eq(products.id, productFreightLinks.productId),
          eq(productFreightLinks.isApproved, true)
        )
      )
      .where(
        and(
          eq(products.isActive, true),
          eq(productFreightLinks.id, null) // No approved links
        )
      );
    
    return unlinkedProducts;
  });
  
  // Cache for 2 minutes (changes frequently)
  await KVCache.set(cacheKey, result, 120);
  
  return result;
}
