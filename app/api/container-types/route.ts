import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';
import { eq, and, or, ilike } from 'drizzle-orm';

export const runtime = 'edge';

// GET - Fetch all container types with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const material = searchParams.get('material');
    const containerType = searchParams.get('containerType');
    const active = searchParams.get('active');
    
    let query = db.select().from(containerTypes);
    
    // Apply filters
    const filters = [];
    
    if (search) {
      filters.push(
        or(
          ilike(containerTypes.shopifyTitle, `%${search}%`),
          ilike(containerTypes.shopifyVariantTitle, `%${search}%`),
          ilike(containerTypes.shopifySku, `%${search}%`)
        )
      );
    }
    
    if (material) {
      filters.push(eq(containerTypes.containerMaterial, material));
    }
    
    if (containerType) {
      filters.push(eq(containerTypes.containerType, containerType));
    }
    
    if (active !== null) {
      filters.push(eq(containerTypes.isActive, active === 'true'));
    }
    
    if (filters.length > 0) {
      query = query.where(and(...filters));
    }
    
    const results = await query;
    
    return NextResponse.json({
      success: true,
      containerTypes: results,
      count: results.length,
    });
  } catch (error) {
    console.error('[CONTAINER TYPES] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container types' },
      { status: 500 }
    );
  }
}

// POST - Create new container type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.shopifyProductId || !body.shopifyVariantId || !body.shopifyTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: shopifyProductId, shopifyVariantId, shopifyTitle' },
        { status: 400 }
      );
    }
    
    // Check if container type already exists for this variant
    const existing = await db.select()
      .from(containerTypes)
      .where(eq(containerTypes.shopifyVariantId, body.shopifyVariantId));
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Container type already exists for this Shopify variant' },
        { status: 409 }
      );
    }
    
    // Create new container type
    const newContainerType = await db.insert(containerTypes).values({
      shopifyProductId: body.shopifyProductId,
      shopifyVariantId: body.shopifyVariantId,
      shopifyTitle: body.shopifyTitle,
      shopifyVariantTitle: body.shopifyVariantTitle,
      shopifySku: body.shopifySku,
      containerMaterial: body.containerMaterial || 'poly',
      containerType: body.containerType,
      capacity: body.capacity ? body.capacity.toString() : null,
      capacityUnit: body.capacityUnit || 'gallons',
      length: body.length ? body.length.toString() : null,
      width: body.width ? body.width.toString() : null,
      height: body.height ? body.height.toString() : null,
      emptyWeight: body.emptyWeight ? body.emptyWeight.toString() : null,
      maxGrossWeight: body.maxGrossWeight ? body.maxGrossWeight.toString() : null,
      freightClass: body.freightClass,
      nmfcCode: body.nmfcCode,
      unRating: body.unRating,
      hazmatApproved: body.hazmatApproved || false,
      isStackable: body.isStackable !== false,
      maxStackHeight: body.maxStackHeight || 1,
      isReusable: body.isReusable !== false,
      requiresLiner: body.requiresLiner || false,
      notes: body.notes,
      isActive: body.isActive !== false,
      createdBy: body.createdBy || 'system',
      updatedBy: body.updatedBy || 'system',
    }).returning();
    
    return NextResponse.json({
      success: true,
      containerType: newContainerType[0],
    });
  } catch (error) {
    console.error('[CONTAINER TYPES] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create container type' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update container types (for material toggle functionality)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids, data } = body;
    
    if (!action || !ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Invalid request: action and ids array required' },
        { status: 400 }
      );
    }
    
    let updateData = { updatedAt: new Date() };
    
    switch (action) {
      case 'toggleMaterial':
        // Toggle between metal and poly
        if (data?.material === 'metal' || data?.material === 'poly') {
          updateData = { ...updateData, containerMaterial: data.material };
        } else {
          return NextResponse.json(
            { error: 'Invalid material: must be "metal" or "poly"' },
            { status: 400 }
          );
        }
        break;
        
      case 'updateFields':
        // Update specific fields
        if (data) {
          Object.keys(data).forEach(key => {
            if (key in containerTypes && key !== 'id' && key !== 'createdAt') {
              updateData[key] = data[key];
            }
          });
        }
        break;
        
      case 'activate':
        updateData = { ...updateData, isActive: true };
        break;
        
      case 'deactivate':
        updateData = { ...updateData, isActive: false };
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    // Update all specified container types
    const results = [];
    for (const id of ids) {
      const updated = await db.update(containerTypes)
        .set(updateData)
        .where(eq(containerTypes.id, id))
        .returning();
      results.push(...updated);
    }
    
    return NextResponse.json({
      success: true,
      updated: results.length,
      containerTypes: results,
    });
  } catch (error) {
    console.error('[CONTAINER TYPES] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update container types' },
      { status: 500 }
    );
  }
}