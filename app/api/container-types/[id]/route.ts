import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

// GET - Fetch single container type by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const containerType = await db.select()
      .from(containerTypes)
      .where(eq(containerTypes.id, id));
    
    if (containerType.length === 0) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      containerType: containerType[0],
    });
  } catch (error) {
    console.error('[CONTAINER TYPE] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container type' },
      { status: 500 }
    );
  }
}

// PUT - Update single container type
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Check if container type exists
    const existing = await db.select()
      .from(containerTypes)
      .where(eq(containerTypes.id, id));
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }
    
    // Prepare update data
    const updateData = {
      shopifyTitle: body.shopifyTitle,
      shopifyVariantTitle: body.shopifyVariantTitle,
      shopifySku: body.shopifySku,
      containerMaterial: body.containerMaterial,
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
      updatedAt: new Date(),
      updatedBy: body.updatedBy || 'system',
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const updated = await db.update(containerTypes)
      .set(updateData)
      .where(eq(containerTypes.id, id))
      .returning();
    
    return NextResponse.json({
      success: true,
      containerType: updated[0],
    });
  } catch (error) {
    console.error('[CONTAINER TYPE] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update container type' },
      { status: 500 }
    );
  }
}

// DELETE - Delete single container type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Check if container type exists
    const existing = await db.select()
      .from(containerTypes)
      .where(eq(containerTypes.id, id));
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      );
    }
    
    // Soft delete by setting isActive to false
    const deleted = await db.update(containerTypes)
      .set({
        isActive: false,
        updatedAt: new Date(),
        updatedBy: 'system',
      })
      .where(eq(containerTypes.id, id))
      .returning();
    
    return NextResponse.json({
      success: true,
      containerType: deleted[0],
      message: 'Container type deactivated successfully',
    });
  } catch (error) {
    console.error('[CONTAINER TYPE] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete container type' },
      { status: 500 }
    );
  }
}