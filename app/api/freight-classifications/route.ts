import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { freightClassifications } from '@/lib/db/schema/freight';
import { eq, like, or, and } from 'drizzle-orm';
import { KVCache } from '@/lib/cache/kv-cache';

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

// Standard freight classes for validation
const VALID_FREIGHT_CLASSES = [
  '50', '55', '60', '65', '70', '77.5', '85', '92.5', 
  '100', '110', '125', '150', '175', '200', '250', '300', '400', '500'
];

// GET /api/freight-classifications - List all freight classifications with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const hazmat = searchParams.get('hazmat');
    const freightClass = searchParams.get('freightClass');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Create cache key
    const cacheKey = `classifications:${search || 'all'}:${hazmat}:${freightClass}:${limit}:${offset}`;
    
    // Try cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    const result = await withEdgeRetry(async () => {
      let query = db.select().from(freightClassifications);
      
      // Build where conditions
      const conditions = [];
      
      if (hazmat === 'true') {
        conditions.push(eq(freightClassifications.isHazmat, true));
      } else if (hazmat === 'false') {
        conditions.push(eq(freightClassifications.isHazmat, false));
      }
      
      if (freightClass && VALID_FREIGHT_CLASSES.includes(freightClass)) {
        conditions.push(eq(freightClassifications.freightClass, freightClass));
      }
      
      if (search) {
        conditions.push(
          or(
            like(freightClassifications.description, `%${search}%`),
            like(freightClassifications.nmfcCode, `%${search}%`),
            like(freightClassifications.hazmatClass, `%${search}%`)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const classificationList = await query
        .limit(limit)
        .offset(offset)
        .execute();
      
      return classificationList;
    });
    
    // Cache for 10 minutes (freight classifications change infrequently)
    await KVCache.set(cacheKey, result, 600);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching freight classifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch freight classifications' },
      { status: 500 }
    );
  }
}

// POST /api/freight-classifications - Create new freight classification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.description || !body.freightClass) {
      return NextResponse.json(
        { error: 'Description and freight class are required' },
        { status: 400 }
      );
    }
    
    // Validate freight class
    if (!VALID_FREIGHT_CLASSES.includes(body.freightClass)) {
      return NextResponse.json(
        { error: `Invalid freight class. Must be one of: ${VALID_FREIGHT_CLASSES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate hazmat data consistency
    if (body.isHazmat && !body.hazmatClass) {
      return NextResponse.json(
        { error: 'Hazmat class is required for hazardous materials' },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [newClassification] = await db
        .insert(freightClassifications)
        .values({
          description: body.description,
          nmfcCode: body.nmfcCode,
          freightClass: body.freightClass,
          isHazmat: body.isHazmat || false,
          hazmatClass: body.hazmatClass,
          packingGroup: body.packingGroup,
          packagingInstructions: body.packagingInstructions,
          specialHandling: body.specialHandling,
          minDensity: body.minDensity ? parseFloat(body.minDensity) : null,
          maxDensity: body.maxDensity ? parseFloat(body.maxDensity) : null,
        })
        .returning();
      
      return newClassification;
    });
    
    // Clear cache
    await KVCache.deletePattern('classifications:*');
    
    return NextResponse.json(result, { status: 201 });
    
  } catch (error) {
    console.error('Error creating freight classification:', error);
    
    return NextResponse.json(
      { error: 'Failed to create freight classification' },
      { status: 500 }
    );
  }
}

// PUT /api/freight-classifications - Update existing classification
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Classification ID is required' },
        { status: 400 }
      );
    }
    
    // Validate freight class if provided
    if (body.freightClass && !VALID_FREIGHT_CLASSES.includes(body.freightClass)) {
      return NextResponse.json(
        { error: `Invalid freight class. Must be one of: ${VALID_FREIGHT_CLASSES.join(', ')}` },
        { status: 400 }
      );
    }
    
    const result = await withEdgeRetry(async () => {
      const [updatedClassification] = await db
        .update(freightClassifications)
        .set({
          description: body.description,
          nmfcCode: body.nmfcCode,
          freightClass: body.freightClass,
          isHazmat: body.isHazmat,
          hazmatClass: body.hazmatClass,
          packingGroup: body.packingGroup,
          packagingInstructions: body.packagingInstructions,
          specialHandling: body.specialHandling,
          minDensity: body.minDensity ? parseFloat(body.minDensity) : null,
          maxDensity: body.maxDensity ? parseFloat(body.maxDensity) : null,
          updatedAt: new Date(),
        })
        .where(eq(freightClassifications.id, body.id))
        .returning();
      
      return updatedClassification;
    });
    
    if (!result) {
      return NextResponse.json(
        { error: 'Classification not found' },
        { status: 404 }
      );
    }
    
    // Clear cache
    await KVCache.deletePattern('classifications:*');
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error updating freight classification:', error);
    return NextResponse.json(
      { error: 'Failed to update freight classification' },
      { status: 500 }
    );
  }
}
