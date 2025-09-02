import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql, withEdgeRetry } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Body = {
  productId?: string;
  sku?: string;
  freightClass: string; // e.g., "85", "100"
  nmfcCode?: string; // e.g., "12345"
  nmfcSub?: string; // e.g., "03" -> stored as 12345-03
  description?: string; // label/notes
  approve?: boolean; // default true
};

export async function POST(request: NextRequest) {
  try {
    const sql = getEdgeSql();
    const body = (await request.json()) as Body;

    const {
      productId,
      sku,
      freightClass,
      nmfcCode,
      nmfcSub,
      description,
      approve = true,
    } = body;

    if ((!productId && !sku) || !freightClass) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'Provide productId or sku, and freightClass',
        },
        { status: 400 },
      );
    }

    // Resolve product ID
    const productRows = await withEdgeRetry(async () => {
      if (productId) {
        return (await sql`SELECT id, sku, name FROM products WHERE id = ${productId} LIMIT 1`) as any[];
      }
      return (await sql`SELECT id, sku, name FROM products WHERE sku = ${sku} LIMIT 1`) as any[];
    });

    if (!productRows?.length) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 },
      );
    }

    const product = productRows[0];

    // Normalize NMFC code (combine code + sub if provided)
    const nmfc_full = nmfcCode
      ? `${nmfcCode}${nmfcSub ? `-${nmfcSub}` : ''}`
      : null;

    // Find or create classification row (by nmfc_code + freight_class + description)
    const existingClassRows = (await withEdgeRetry(async () =>
      (await sql`
        SELECT id 
        FROM freight_classifications 
        WHERE freight_class = ${freightClass}
          AND COALESCE(nmfc_code, '') = COALESCE(${nmfc_full}, '')
          AND COALESCE(description, '') = COALESCE(${description || ''}, '')
        LIMIT 1
      `) as any[]
    ));

    let classificationId: string;
    if (existingClassRows.length) {
      classificationId = existingClassRows[0].id;
    } else {
      const inserted = (await withEdgeRetry(async () =>
        (await sql`
          INSERT INTO freight_classifications (
            id, description, nmfc_code, freight_class, is_hazmat, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${description || `Manual classification ${freightClass}`},
            ${nmfc_full},
            ${freightClass},
            false,
            NOW(), NOW()
          )
          RETURNING id
        `) as any[]
      ));
      classificationId = inserted[0].id;
    }

    // Link product -> classification (manual, approved per flag)
    // Use existence check to avoid requiring a DB unique constraint
    const existingLinkRows = (await withEdgeRetry(async () =>
      (await sql`
        SELECT id FROM product_freight_links
        WHERE product_id = ${product.id} AND classification_id = ${classificationId}
        LIMIT 1
      `) as any[]
    ));

    if (existingLinkRows.length) {
      await withEdgeRetry(async () => {
        await sql`
          UPDATE product_freight_links
          SET 
            link_source = 'manual',
            is_approved = ${approve},
            approved_by = ${approve ? 'api/products/freight-link' : null},
            approved_at = ${approve ? sql`NOW()` : null},
            updated_at = NOW(),
            updated_by = 'api/products/freight-link'
          WHERE id = ${existingLinkRows[0].id}
        `;
      });
    } else {
      await withEdgeRetry(async () => {
        await sql`
          INSERT INTO product_freight_links (
            id, product_id, classification_id,
            link_source, is_approved, approved_by, approved_at,
            created_at, created_by, updated_at, updated_by
          ) VALUES (
            gen_random_uuid(),
            ${product.id}, ${classificationId},
            'manual', ${approve}, ${approve ? 'api/products/freight-link' : null}, ${approve ? sql`NOW()` : null},
            NOW(), 'api/products/freight-link', NOW(), 'api/products/freight-link'
          )
        `;
      });
    }

    return NextResponse.json({
      success: true,
      product: { id: product.id, sku: product.sku, name: product.name },
      classification: {
        id: classificationId,
        nmfcCode: nmfc_full,
        freightClass,
        description: description || null,
        isHazmat: false,
      },
      link: {
        source: 'manual',
        isApproved: approve,
      },
    });
  } catch (error) {
    console.error('freight-link error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to link freight classification' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST to manually link product to classification',
    example: {
      sku: 'ABC-123',
      freightClass: '85',
      nmfcCode: '12345',
      nmfcSub: '03',
      description: 'Paints, NMFC 12345-03',
      approve: true,
    },
  });
}

