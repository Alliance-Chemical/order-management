import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { products } from '@/lib/db/schema/freight';
import { eq, like, or, and } from 'drizzle-orm';
import { KVCache } from '@/lib/cache/kv-cache';

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

// GET /api/products - List all chemical products with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const hazardous = searchParams.get('hazardous');
    const active = searchParams.get('active') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Create cache key based on parameters
    const cacheKey = `products:${search || 'all'}:${hazardous}:${active}:${limit}:${offset}`;
    
    // Try cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    const result = await withEdgeRetry(async () => {
      // Build where conditions
      const conditions = [];

      if (active) {
        conditions.push(eq(products.isActive, true));
      }

      if (hazardous === 'true') {
        conditions.push(eq(products.isHazardous, true));
      } else if (hazardous === 'false') {
        conditions.push(eq(products.isHazardous, false));
      }

      if (search) {
        conditions.push(
          or(
            like(products.name, `%${search}%`),
            like(products.sku, `%${search}%`),
            like(products.description, `%${search}%`),
            like(products.casNumber, `%${search}%`),
            like(products.unNumber, `%${search}%`)
          )
        );
      }

      // Build query conditionally to avoid type reassignment issues
      const baseQuery = db.select().from(products);
      const queryWithConditions = conditions.length > 0
        ? baseQuery.where(and(...conditions))
        : baseQuery;

      const productList = await queryWithConditions
        .limit(limit)
        .offset(offset)
        .execute();

      return productList;
    });
    
    // Cache for 5 minutes
    await KVCache.set(cacheKey, result, 300);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create new chemical product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.sku || !body.name) {
      return NextResponse.json(
        { error: 'SKU and name are required' },
        { status: 400 }
      );
    }
    
    // Validate hazmat data consistency
    if (body.isHazardous && !body.unNumber) {
      return NextResponse.json(
        { error: 'UN number is required for hazardous materials' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [newProduct] = await db
        .insert(products)
        .values({
          sku: body.sku,
          name: body.name,
          description: body.description,
          weight: body.weight ? parseFloat(body.weight) : null,
          length: body.length ? parseFloat(body.length) : null,
          width: body.width ? parseFloat(body.width) : null,
          height: body.height ? parseFloat(body.height) : null,
          packagingType: body.packagingType,
          unitsPerPackage: body.unitsPerPackage || 1,
          unitContainerType: body.unitContainerType,
          isHazardous: body.isHazardous || false,
          casNumber: body.casNumber,
          unNumber: body.unNumber,
          isActive: body.isActive !== false,
        })
        .returning();
      
      return newProduct;
    });
    
    // Clear cache
    await KVCache.deletePattern('products:*');
    
    return NextResponse.json(result, { status: 201 });
    
  } catch (error: unknown) {
    console.error('Error creating product:', error);
    
    // Handle duplicate SKU
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Product SKU already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT /api/products - Update existing product
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [updatedProduct] = await db
        .update(products)
        .set({
          name: body.name,
          description: body.description,
          weight: body.weight ? parseFloat(body.weight) : null,
          length: body.length ? parseFloat(body.length) : null,
          width: body.width ? parseFloat(body.width) : null,
          height: body.height ? parseFloat(body.height) : null,
          packagingType: body.packagingType,
          unitsPerPackage: body.unitsPerPackage,
          unitContainerType: body.unitContainerType,
          isHazardous: body.isHazardous,
          casNumber: body.casNumber,
          unNumber: body.unNumber,
          isActive: body.isActive,
          updatedAt: new Date(),
        })
        .where(eq(products.id, body.id))
        .returning();
      
      return updatedProduct;
    });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Clear cache
    await KVCache.deletePattern('products:*');
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products - Soft delete product (set inactive)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [deletedProduct] = await db
        .update(products)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();
      
      return deletedProduct;
    });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Clear cache
    await KVCache.deletePattern('products:*');
    
    return NextResponse.json({ message: 'Product deactivated successfully' });
    
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
