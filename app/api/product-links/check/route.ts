import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { sku } = await request.json();

    if (!sku) {
      return NextResponse.json({
        success: false,
        error: 'SKU is required'
      }, { status: 400 });
    }

    const sql = getEdgeSql();
    
    // First check if product exists
    const productCheck = await sql`
      SELECT id, sku, name, is_hazardous, un_number 
      FROM products 
      WHERE sku = ${sku} 
      LIMIT 1
    `;
    
    if (productCheck.length === 0) {
      // Product doesn't exist yet - this is normal for new products
      return NextResponse.json({
        success: true,
        hasClassification: false,
        message: `Product ${sku} not yet in database`
      });
    }
    
    // Check if product has approved classification links
    const result = await sql`
      SELECT 
         p.sku, p.name, p.is_hazardous, p.un_number,
         fc.description as classification_description,
         fc.nmfc_code, fc.freight_class, fc.is_hazmat,
         fc.hazmat_class, fc.packing_group
       FROM products p
       JOIN product_freight_links pfl ON p.id = pfl.product_id
       JOIN freight_classifications fc ON pfl.classification_id = fc.id
       WHERE p.sku = ${sku} AND pfl.is_approved = true
       LIMIT 1
    `;

    if (result.length > 0) {
      const classification = result[0];
      return NextResponse.json({
        success: true,
        hasClassification: true,
        classification: {
          sku: classification.sku,
          name: classification.name,
          isHazardous: classification.is_hazardous,
          description: classification.classification_description,
          nmfcCode: classification.nmfc_code,
          freightClass: classification.freight_class,
          isHazmat: classification.is_hazmat,
          hazmatClass: classification.hazmat_class,
          unNumber: classification.un_number,
          packingGroup: classification.packing_group,
          properShippingName: classification.name
        }
      });
    }

    return NextResponse.json({
      success: true,
      hasClassification: false,
      message: `No approved classification found for SKU: ${sku}`
    });

  } catch (error) {
    console.error('Classification check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check classification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Product classification check API is operational',
    version: '1.0.0'
  });
}