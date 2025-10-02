import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Updated HAZMAT NMFC mappings with correct freight classes
// Higher freight classes = more handling requirements/cost
const HAZMAT_NMFC_MAPPINGS: Record<string, { nmfc: string; freightClass: string }> = {
  '1.1': { nmfc: '48580', freightClass: '85' },   // Explosives 1.1
  '1.2': { nmfc: '48580', freightClass: '85' },   // Explosives 1.2
  '1.3': { nmfc: '48580', freightClass: '85' },   // Explosives 1.3
  '1.4': { nmfc: '48590', freightClass: '70' },   // Explosives 1.4 (lower risk)
  '1.5': { nmfc: '48580', freightClass: '85' },   // Explosives 1.5
  '1.6': { nmfc: '48580', freightClass: '85' },   // Explosives 1.6
  '2.1': { nmfc: '48615', freightClass: '92.5' }, // Flammable Gas - HIGHER CLASS
  '2.2': { nmfc: '48620', freightClass: '85' },   // Non-flammable Gas
  '2.3': { nmfc: '48625', freightClass: '92.5' }, // Poison Gas - HIGHER CLASS
  '3': { nmfc: '48635', freightClass: '92.5' },   // Flammable Liquids - HIGHER CLASS
  '4.1': { nmfc: '48640', freightClass: '92.5' }, // Flammable Solids - HIGHER CLASS
  '4.2': { nmfc: '48645', freightClass: '100' },  // Spontaneously Combustible - HIGH RISK
  '4.3': { nmfc: '48650', freightClass: '100' },  // Dangerous When Wet - HIGH RISK
  '5.1': { nmfc: '48655', freightClass: '85' },   // Oxidizers
  '5.2': { nmfc: '48660', freightClass: '100' },  // Organic Peroxides - HIGH RISK
  '6.1': { nmfc: '48665', freightClass: '92.5' }, // Poison - HIGHER CLASS
  '6.2': { nmfc: '48670', freightClass: '85' },   // Infectious Substances
  '7': { nmfc: '48675', freightClass: '85' },     // Radioactive
  '8': { nmfc: '48680', freightClass: '92.5' },   // Corrosives - HIGHER CLASS
  '9': { nmfc: '48685', freightClass: '85' },     // Miscellaneous Dangerous Goods
};

// Density-based freight class for NON-HAZMAT
function getDensityBasedClass(density: number): { 
  nmfcSub: string; 
  freightClass: string; 
  description: string 
} {
  // NMFC 43940 is the general commodity code for density-based classification
  if (density >= 35) {
    return { nmfcSub: '01', freightClass: '50', description: 'Very High Density' };
  } else if (density >= 30) {
    return { nmfcSub: '01', freightClass: '55', description: 'High Density' };
  } else if (density >= 22.5) {
    return { nmfcSub: '02', freightClass: '60', description: 'High Density' };
  } else if (density >= 15) {
    return { nmfcSub: '02', freightClass: '70', description: 'Moderate-High Density' };
  } else if (density >= 10.5) {
    return { nmfcSub: '03', freightClass: '85', description: 'Moderate Density' };
  } else if (density >= 9) {
    return { nmfcSub: '03', freightClass: '92.5', description: 'Moderate Density' };
  } else if (density >= 7) {
    return { nmfcSub: '04', freightClass: '100', description: 'Low-Moderate Density' };
  } else if (density >= 5) {
    return { nmfcSub: '04', freightClass: '110', description: 'Low Density' };
  } else if (density >= 4) {
    return { nmfcSub: '04', freightClass: '125', description: 'Low Density' };
  } else if (density >= 2) {
    return { nmfcSub: '05', freightClass: '150', description: 'Very Low Density' };
  } else if (density >= 1) {
    return { nmfcSub: '06', freightClass: '175', description: 'Extra Low Density' };
  } else {
    return { nmfcSub: '07', freightClass: '200', description: 'Ultra Low Density' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      sku,
      productName,
      weight,      // in lbs
      length,      // in inches
      width,       // in inches
      height,      // in inches
      quantity = 1,
      isHazmat,
      hazardClass,
      packingGroup,
      unNumber
    } = body;

    const sql = getEdgeSql();
    
    // ==========================
    // STEP 1: Check saved classifications
    // ==========================
    if (sku) {
      // First check if product exists and get its dimensions if not provided
      const productData = await sql`
        SELECT 
          p.id,
          p.sku,
          p.name,
          p.is_hazardous,
          p.un_number,
          p.weight,
          p.length,
          p.width,
          p.height
        FROM products p
        WHERE p.sku = ${sku}
        LIMIT 1
      `;
      
      // Use product dimensions if not provided in request
      let finalWeight = weight;
      let finalLength = length;
      let finalWidth = width;
      let finalHeight = height;

      if (Array.isArray(productData) && productData.length > 0) {
        const product = productData[0] as Record<string, any>;
        finalWeight = weight || product.weight;
        finalLength = length || product.length;
        finalWidth = width || product.width;
        finalHeight = height || product.height;
        
        // Check for approved classification
        const existing = await sql`
          SELECT 
            fc.nmfc_code,
            fc.freight_class,
            fc.description,
            fc.hazmat_class,
            fc.packing_group,
            pfl.confidence_score
          FROM product_freight_links pfl
          JOIN freight_classifications fc ON pfl.classification_id = fc.id
          WHERE pfl.product_id = ${product.id}
            AND pfl.is_approved = true
          LIMIT 1
        `;

        if (Array.isArray(existing) && existing.length > 0) {
          const record = existing[0] as Record<string, any>;
          // Parse NMFC code and sub if combined (e.g., "43940-01")
          const nmfcParts = record.nmfc_code?.split('-') || [];

          return NextResponse.json({
            success: true,
            source: 'saved-classification',
            isHazmat: product.is_hazardous,
            suggestion: {
              nmfcCode: nmfcParts[0] || record.nmfc_code,
              nmfcSub: nmfcParts[1] || '',
              freightClass: record.freight_class,
              description: record.description,
              confidence: record.confidence_score || 0.95,
              hazardClass: record.hazmat_class,
              packingGroup: record.packing_group,
              label: `${record.description} - NMFC ${record.nmfc_code || 'N/A'} (Class ${record.freight_class})`
            },
            message: 'Using previously saved classification'
          });
        }
      }

      // Update dimensions for density calculation (use let instead of const reassignment)
      weight = weight || finalWeight;
      length = length || finalLength;
      width = width || finalWidth;
      height = height || finalHeight;
    }

    // ==========================
    // STEP 2: HAZMAT Classification (Class-based, NOT density)
    // ==========================
    if (isHazmat || hazardClass || unNumber) {
      let finalHazardClass = hazardClass;
      
      // If we have UN number but no hazard class, look it up
      if (unNumber && !hazardClass) {
        // Try to find in existing products first
        const productLookup = await sql`
          SELECT hazmat_class
          FROM freight_classifications fc
          JOIN products p ON p.un_number = ${unNumber}
          WHERE fc.is_hazmat = true
          LIMIT 1
        `;

        if (Array.isArray(productLookup) && productLookup.length > 0) {
          finalHazardClass = (productLookup[0] as Record<string, any>).hazmat_class;
        }
      }
      
      // Get NMFC based on hazard class
      const hazmatMapping = HAZMAT_NMFC_MAPPINGS[finalHazardClass] || 
                           HAZMAT_NMFC_MAPPINGS[finalHazardClass?.split('.')[0]] || // Try main class if subclass not found
                           { nmfc: '48685', freightClass: '85' }; // Default hazmat
      
      const description = `HAZMAT Class ${finalHazardClass}${packingGroup ? ` PG ${packingGroup}` : ''} - ${productName || 'Chemical Product'}`;
      
      return NextResponse.json({
        success: true,
        source: 'hazmat-classification',
        isHazmat: true,
        suggestion: {
          nmfcCode: hazmatMapping.nmfc,
          nmfcSub: '',
          freightClass: hazmatMapping.freightClass,
          description,
          confidence: 0.9,
          hazardClass: finalHazardClass,
          packingGroup,
          unNumber,
          label: `${description} - NMFC ${hazmatMapping.nmfc} (Class ${hazmatMapping.freightClass})`,
          note: 'HAZMAT uses class-specific NMFC codes, not density-based classification'
        },
        requiresDOT: true,
        requiresPlacards: true
      });
    }

    // ==========================
    // STEP 3: NON-HAZMAT Density Classification
    // ==========================
    if (weight && length && width && height && quantity) {
      // Calculate density
      const cubicFeet = (length * width * height * quantity) / 1728; // Convert cubic inches to cubic feet
      const totalWeight = weight * quantity;
      const density = totalWeight / cubicFeet;
      
      const classification = getDensityBasedClass(density);
      const description = `${productName || 'General Commodity'} - ${classification.description} (${density.toFixed(2)} lbs/ft³)`;
      
      return NextResponse.json({
        success: true,
        source: 'density-calculation',
        isHazmat: false,
        suggestion: {
          nmfcCode: '43940', // General commodity NMFC
          nmfcSub: classification.nmfcSub,
          freightClass: classification.freightClass,
          description,
          confidence: 0.85,
          density: density.toFixed(2),
          label: `Density ${density.toFixed(2)} lbs/ft³ → NMFC 43940-${classification.nmfcSub} (Class ${classification.freightClass})`,
          calculationDetails: {
            weight: totalWeight,
            cubicFeet: cubicFeet.toFixed(2),
            density: density.toFixed(2)
          }
        },
        message: 'Classification based on density calculation'
      });
    }

    // ==========================
    // STEP 4: Insufficient data - return error
    // ==========================
    return NextResponse.json({
      success: false,
      error: 'Insufficient data for classification',
      message: 'Please provide either: (1) dimensions and weight for density calculation, or (2) hazard class for hazmat classification',
      missingFields: {
        forDensity: !weight || !length || !width || !height ? ['weight', 'length', 'width', 'height'].filter(f => !body[f]) : [],
        forHazmat: !hazardClass && !unNumber ? ['hazardClass or unNumber'] : []
      }
    }, { status: 400 });

  } catch (error) {
    console.error('NMFC suggestion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate NMFC suggestion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'NMFC Suggestion API',
    endpoints: {
      POST: {
        description: 'Get NMFC code suggestion based on product attributes',
        requiredForNonHazmat: ['weight', 'length', 'width', 'height'],
        requiredForHazmat: ['hazardClass or unNumber'],
        optional: ['sku', 'productName', 'quantity', 'packingGroup']
      }
    },
    hazmatClasses: Object.keys(HAZMAT_NMFC_MAPPINGS)
  });
}