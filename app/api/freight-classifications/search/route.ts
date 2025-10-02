import { NextRequest, NextResponse } from 'next/server';
import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { freightClassifications } from '@/lib/db/schema/freight';
import { eq, and, or, ilike } from 'drizzle-orm';

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const db = getEdgeDb();

interface SearchRequest {
  // Product info
  sku?: string;
  productName?: string;
  
  // Hazmat properties (for HAZMAT items)
  unNumber?: string;
  hazardClass?: string;
  packingGroup?: string;
  isHazmat?: boolean;
  
  // Physical properties (for NON-HAZMAT density calculation)
  weight?: number;  // in lbs
  length?: number;  // in inches
  width?: number;   // in inches
  height?: number;  // in inches
  quantity?: number; // number of units
  
  // Direct search
  description?: string;
}

interface ClassificationMatch {
  id: string;
  description: string;
  nmfcCode: string | null;
  nmfcSub?: string;
  freightClass: string;
  isHazmat: boolean;
  hazmatClass?: string | null;
  packingGroup?: string | null;
  confidence: number;
  matchReason: string;
}

/**
 * Calculate density for NON-HAZMAT items
 */
function calculateDensity(weight: number, length: number, width: number, height: number, quantity: number = 1): number {
  // Convert cubic inches to cubic feet
  const cubicFeet = (length * width * height * quantity) / 1728;
  const totalWeight = weight * quantity;
  
  // Density in lbs per cubic foot
  return totalWeight / cubicFeet;
}

/**
 * Get NMFC sub-code and freight class based on density (NON-HAZMAT ONLY)
 * Using standard NMFC 43940 for general commodities
 */
function getDensityBasedClassification(density: number): { nmfcSub: string; freightClass: string } {
  if (density >= 35) {
    return { nmfcSub: '01', freightClass: '50' };
  } else if (density >= 30) {
    return { nmfcSub: '01', freightClass: '55' };
  } else if (density >= 22.5) {
    return { nmfcSub: '02', freightClass: '60' };
  } else if (density >= 15) {
    return { nmfcSub: '02', freightClass: '70' };
  } else if (density >= 10.5) {
    return { nmfcSub: '03', freightClass: '85' };
  } else if (density >= 9) {
    return { nmfcSub: '03', freightClass: '92.5' };
  } else if (density >= 7) {
    return { nmfcSub: '04', freightClass: '100' };
  } else if (density >= 5) {
    return { nmfcSub: '04', freightClass: '110' };
  } else if (density >= 4) {
    return { nmfcSub: '04', freightClass: '125' };
  } else {
    return { nmfcSub: '04', freightClass: '150' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const matches: ClassificationMatch[] = [];
    
    // Determine if this is a hazmat item
    const isHazmat = body.isHazmat || !!body.hazardClass || !!body.unNumber;
    
    if (isHazmat) {
      // ========== HAZMAT CLASSIFICATION LOGIC ==========
      // For hazmat items, we NEVER use density calculations
      // We look up specific hazmat classifications

      const conditions: ReturnType<typeof eq | typeof ilike>[] = [];

      // Always filter for hazmat classifications
      conditions.push(eq(freightClassifications.isHazmat, true));

      // Match on hazard class (only if defined)
      if (body.hazardClass && typeof body.hazardClass === 'string') {
        conditions.push(eq(freightClassifications.hazmatClass, body.hazardClass));
      }

      // Match on packing group if provided
      if (body.packingGroup) {
        conditions.push(eq(freightClassifications.packingGroup, body.packingGroup));
      }

      // Try to find exact match first
      const exactMatches = await withEdgeRetry(async () => {
        return await db.select()
          .from(freightClassifications)
          .where(and(...conditions))
          .limit(5);
      });
      
      // Look for description matches if we have a product name
      if (body.productName || body.description) {
        const searchTerm = body.productName || body.description || '';
        
        for (const match of exactMatches) {
          let confidence = 0.5; // Base confidence for hazmat match
          let matchReason = `Hazmat Class ${body.hazardClass}`;
          
          // Boost confidence for exact packing group match
          if (body.packingGroup && match.packingGroup === body.packingGroup) {
            confidence += 0.2;
            matchReason += `, PG ${body.packingGroup}`;
          }
          
          // Boost confidence for description match
          if (match.description && searchTerm && 
              match.description.toLowerCase().includes(searchTerm.toLowerCase())) {
            confidence += 0.3;
            matchReason += ', description match';
          }
          
          matches.push({
            id: match.id,
            description: match.description,
            nmfcCode: match.nmfcCode,
            freightClass: match.freightClass,
            isHazmat: true,
            hazmatClass: match.hazmatClass,
            packingGroup: match.packingGroup,
            confidence,
            matchReason
          });
        }
      } else {
        // No product name, use all hazmat matches
        exactMatches.forEach(match => {
          matches.push({
            id: match.id,
            description: match.description,
            nmfcCode: match.nmfcCode,
            freightClass: match.freightClass,
            isHazmat: true,
            hazmatClass: match.hazmatClass,
            packingGroup: match.packingGroup,
            confidence: body.packingGroup === match.packingGroup ? 0.7 : 0.5,
            matchReason: `Hazmat Class ${body.hazardClass}${body.packingGroup ? `, PG ${body.packingGroup}` : ''}`
          });
        });
      }
      
      // If no specific matches found, look for generic hazmat classifications
      if (matches.length === 0 && body.hazardClass) {
        const genericHazmat = await withEdgeRetry(async () => {
          const filters = [eq(freightClassifications.isHazmat, true)];
          if (body.hazardClass) {
            filters.push(eq(freightClassifications.hazmatClass, body.hazardClass));
          }
          return await db.select()
            .from(freightClassifications)
            .where(and(...filters))
            .limit(1);
        });
        
        if (genericHazmat.length > 0) {
          matches.push({
            id: genericHazmat[0].id,
            description: genericHazmat[0].description,
            nmfcCode: genericHazmat[0].nmfcCode,
            freightClass: genericHazmat[0].freightClass,
            isHazmat: true,
            hazmatClass: genericHazmat[0].hazmatClass,
            packingGroup: genericHazmat[0].packingGroup,
            confidence: 0.3,
            matchReason: `Generic Hazmat Class ${body.hazardClass}`
          });
        }
      }
      
    } else {
      // ========== NON-HAZMAT CLASSIFICATION LOGIC ==========
      // For non-hazmat items, we use density calculations
      
      let calculatedDensity: number | null = null;
      let densityClassification: { nmfcSub: string; freightClass: string } | null = null;
      
      // Calculate density if we have dimensions and weight
      if (body.weight && body.length && body.width && body.height) {
        calculatedDensity = calculateDensity(
          body.weight,
          body.length,
          body.width,
          body.height,
          body.quantity || 1
        );
        
        densityClassification = getDensityBasedClassification(calculatedDensity);
        
        // Create a density-based classification
        matches.push({
          id: 'density-calc',
          description: `General Commodity - Density ${calculatedDensity.toFixed(2)} lbs/ft³`,
          nmfcCode: '43940', // Standard NMFC for general commodities
          nmfcSub: densityClassification.nmfcSub,
          freightClass: densityClassification.freightClass,
          isHazmat: false,
          confidence: 0.9, // High confidence for density calculation
          matchReason: `Calculated from density: ${calculatedDensity.toFixed(2)} lbs/ft³`
        });
      }
      
      // Also look for specific non-hazmat classifications in database
      if (body.productName || body.description) {
        const searchTerm = body.productName || body.description || '';
        
        const dbMatches = await withEdgeRetry(async () => {
          return await db.select()
            .from(freightClassifications)
            .where(and(
              eq(freightClassifications.isHazmat, false),
              or(
                ilike(freightClassifications.description, `%${searchTerm}%`),
                ilike(freightClassifications.description, `%${searchTerm.split(' ')[0]}%`)
              )
            ))
            .limit(3);
        });
        
        for (const match of dbMatches) {
          // If we have density, check if it falls within the classification's range
          let confidence = 0.5;
          let matchReason = 'Description match';
          
          if (calculatedDensity && match.minDensity && match.maxDensity) {
            const minDensity = parseFloat(match.minDensity.toString());
            const maxDensity = parseFloat(match.maxDensity.toString());
            
            if (calculatedDensity >= minDensity && calculatedDensity <= maxDensity) {
              confidence = 0.95; // Very high confidence for density + description match
              matchReason = `Description + density match (${calculatedDensity.toFixed(2)} lbs/ft³)`;
            }
          }
          
          matches.push({
            id: match.id,
            description: match.description,
            nmfcCode: match.nmfcCode,
            freightClass: match.freightClass,
            isHazmat: false,
            confidence,
            matchReason
          });
        }
      }
      
      // If no matches and no density calculation, provide generic non-hazmat
      if (matches.length === 0) {
        matches.push({
          id: 'generic-non-hazmat',
          description: 'General Merchandise - No specific classification',
          nmfcCode: '50000',
          freightClass: '100',
          isHazmat: false,
          confidence: 0.1,
          matchReason: 'Default classification - please provide dimensions for accurate classification'
        });
      }
    }
    
    // Sort matches by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return NextResponse.json({
      success: true,
      isHazmat,
      matches: matches.slice(0, 5), // Return top 5 matches
      bestMatch: matches[0] || null
    });
    
  } catch (error) {
    console.error('Classification search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to search classifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
