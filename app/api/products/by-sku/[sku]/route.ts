import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { sku: string } }
) {
  try {
    const sql = getEdgeSql();
    const { sku } = params;
    
    if (!sku) {
      return NextResponse.json({ 
        error: 'SKU parameter is required' 
      }, { status: 400 });
    }
    
    // Fetch product with classification if available
    const result = await sql`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.description,
        p.weight,
        p.length,
        p.width,
        p.height,
        p.packaging_type,
        p.units_per_package,
        p.unit_container_type,
        p.is_hazardous,
        p.cas_number,
        p.un_number,
        fc.nmfc_code,
        fc.freight_class,
        fc.description as classification_description,
        fc.is_hazmat,
        fc.hazmat_class,
        fc.packing_group,
        fc.min_density,
        fc.max_density,
        pfl.confidence_score,
        pfl.link_source
      FROM products p
      LEFT JOIN product_freight_links pfl ON p.id = pfl.product_id AND pfl.is_approved = true
      LEFT JOIN freight_classifications fc ON pfl.classification_id = fc.id
      WHERE p.sku = ${sku}
      LIMIT 1
    `;
    
    if (result.length === 0) {
      return NextResponse.json({ 
        error: 'Product not found',
        sku: sku
      }, { status: 404 });
    }
    
    const product = result[0];
    
    // Format the response
    const response = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      
      // Physical dimensions
      dimensions: {
        weight: product.weight ? parseFloat(product.weight) : null,
        length: product.length ? parseFloat(product.length) : null,
        width: product.width ? parseFloat(product.width) : null,
        height: product.height ? parseFloat(product.height) : null,
      },
      
      // Packaging info
      packaging: {
        type: product.packaging_type,
        unitsPerPackage: product.units_per_package,
        containerType: product.unit_container_type,
      },
      
      // Hazmat info
      hazmat: {
        isHazardous: product.is_hazardous,
        casNumber: product.cas_number,
        unNumber: product.un_number,
      },
      
      // Classification if exists
      classification: product.nmfc_code ? {
        nmfcCode: product.nmfc_code,
        freightClass: product.freight_class,
        description: product.classification_description,
        isHazmat: product.is_hazmat,
        hazmatClass: product.hazmat_class,
        packingGroup: product.packing_group,
        minDensity: product.min_density ? parseFloat(product.min_density) : null,
        maxDensity: product.max_density ? parseFloat(product.max_density) : null,
        confidence: product.confidence_score ? parseFloat(product.confidence_score) : null,
        source: product.link_source
      } : null
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching product by SKU:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Support updating product dimensions
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sku: string } }
) {
  try {
    const sql = getEdgeSql();
    const { sku } = params;
    const body = await request.json();
    
    // Update only dimension fields if provided
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (body.weight !== undefined) {
      updates.push(`weight = $${paramCount++}`);
      values.push(body.weight);
    }
    if (body.length !== undefined) {
      updates.push(`length = $${paramCount++}`);
      values.push(body.length);
    }
    if (body.width !== undefined) {
      updates.push(`width = $${paramCount++}`);
      values.push(body.width);
    }
    if (body.height !== undefined) {
      updates.push(`height = $${paramCount++}`);
      values.push(body.height);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }
    
    // Add SKU as last parameter
    values.push(sku);
    
    const updateQuery = `
      UPDATE products 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE sku = $${paramCount}
      RETURNING id, sku, weight, length, width, height
    `;
    
    const result = await sql.unsafe(updateQuery, values);
    
    if (result.length === 0) {
      return NextResponse.json({ 
        error: 'Product not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      product: result[0]
    });
    
  } catch (error) {
    console.error('Error updating product dimensions:', error);
    return NextResponse.json({ 
      error: 'Failed to update product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}