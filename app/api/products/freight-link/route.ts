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
  hazmatData?: {
    unNumber: string | null;
    hazardClass: string | null;
    packingGroup: string | null;
    properShippingName: string | null;
    isHazmat: boolean;
  };
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
};

type ClassificationRow = {
  id: string;
};

type FreightLinkRow = {
  id: string;
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
      hazmatData,
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

    // Resolve product ID - create if doesn't exist
    let productRows = await withEdgeRetry(async () => {
      if (productId) {
        return sql<ProductRow[]>`
          SELECT id, sku, name
          FROM products
          WHERE id = ${productId}
          LIMIT 1
        `;
      }
      return sql<ProductRow[]>`
        SELECT id, sku, name
        FROM products
        WHERE sku = ${sku}
        LIMIT 1
      `;
    });

    if (!productRows?.length) {
      // Create product if it doesn't exist (common for first-time SKUs)
      const productName = description || hazmatData?.properShippingName || `Product ${sku}`;
      productRows = await withEdgeRetry(async () =>
        sql<ProductRow[]>`
          INSERT INTO products (
            id, sku, name, is_hazardous, un_number, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${sku},
            ${productName},
            ${hazmatData?.isHazmat || false},
            ${hazmatData?.unNumber || null},
            NOW(), NOW()
          )
          RETURNING id, sku, name
        `
      );
    }

    const product = productRows[0];
    
    // Update product with hazmat info if provided
    if (hazmatData) {
      await withEdgeRetry(async () => {
        await sql`
          UPDATE products
          SET 
            is_hazardous = ${hazmatData.isHazmat},
            un_number = ${hazmatData.unNumber},
            updated_at = NOW()
          WHERE id = ${product.id}
        `;
      });
    }

    // Normalize NMFC code (combine code + sub if provided)
    const nmfc_full = nmfcCode
      ? `${nmfcCode}${nmfcSub ? `-${nmfcSub}` : ''}`
      : null;

    // Find or create classification row (by nmfc_code + freight_class + description)
    const existingClassRows = await withEdgeRetry(async () =>
      sql<ClassificationRow[]>`
        SELECT id 
        FROM freight_classifications 
        WHERE freight_class = ${freightClass}
          AND COALESCE(nmfc_code, '') = COALESCE(${nmfc_full}, '')
          AND COALESCE(description, '') = COALESCE(${description || ''}, '')
        LIMIT 1
      `
    );

    let classificationId: string;
    if (existingClassRows.length) {
      classificationId = existingClassRows[0].id;
      // Update classification with hazmat data if provided
      if (hazmatData) {
        await withEdgeRetry(async () => {
          await sql`
            UPDATE freight_classifications
            SET 
              is_hazmat = ${hazmatData.isHazmat},
              hazmat_class = ${hazmatData.hazardClass},
              packing_group = ${hazmatData.packingGroup},
              updated_at = NOW()
            WHERE id = ${classificationId}
          `;
        });
      }
    } else {
      const inserted = await withEdgeRetry(async () =>
        sql<ClassificationRow[]>`
          INSERT INTO freight_classifications (
            id, description, nmfc_code, freight_class, is_hazmat, 
            hazmat_class, packing_group, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${description || hazmatData?.properShippingName || `Manual classification ${freightClass}`},
            ${nmfc_full},
            ${freightClass},
            ${hazmatData?.isHazmat || false},
            ${hazmatData?.hazardClass || null},
            ${hazmatData?.packingGroup || null},
            NOW(), NOW()
          )
          RETURNING id
        `
      );
      classificationId = inserted[0].id;
    }

    // Link product -> classification (manual, approved per flag)
    // Use existence check to avoid requiring a DB unique constraint
    const existingLinkRows = await withEdgeRetry(async () =>
      sql<FreightLinkRow[]>`
        SELECT id FROM product_freight_links
        WHERE product_id = ${product.id} AND classification_id = ${classificationId}
        LIMIT 1
      `
    );

    if (existingLinkRows.length) {
      await withEdgeRetry(async () => {
        await sql`
          UPDATE product_freight_links
          SET 
            link_source = 'manual',
            is_approved = ${approve},
            approved_by = ${approve ? 'api/products/freight-link' : null},
            approved_at = ${approve ? sql`NOW()` : null},
            updated_at = NOW()
          WHERE id = ${existingLinkRows[0].id}
        `;
      });
    } else {
      // Prefer atomic upsert when unique constraint exists
      try {
        await withEdgeRetry(async () => {
          await sql`
            INSERT INTO product_freight_links (
              id, product_id, classification_id,
              link_source, is_approved, approved_by, approved_at,
              created_at, created_by, updated_at
            ) VALUES (
              gen_random_uuid(),
              ${product.id}, ${classificationId},
              'manual', ${approve}, ${approve ? 'api/products/freight-link' : null}, ${approve ? sql`NOW()` : null},
              NOW(), 'api/products/freight-link', NOW()
            )
            ON CONFLICT (product_id, classification_id) DO UPDATE SET
              link_source = EXCLUDED.link_source,
              is_approved = EXCLUDED.is_approved,
              approved_by = EXCLUDED.approved_by,
              approved_at = EXCLUDED.approved_at,
              updated_at = NOW()
          `;
        });
      } catch (_error: unknown) {
        // Fallback if unique index isn't present yet
        await withEdgeRetry(async () => {
          await sql`
            INSERT INTO product_freight_links (
              id, product_id, classification_id,
              link_source, is_approved, approved_by, approved_at,
              created_at, created_by, updated_at
            ) VALUES (
              gen_random_uuid(),
              ${product.id}, ${classificationId},
              'manual', ${approve}, ${approve ? 'api/products/freight-link' : null}, ${approve ? sql`NOW()` : null},
              NOW(), 'api/products/freight-link', NOW()
            )
          `;
        });
      }
    }

    return NextResponse.json({
      success: true,
      product: { 
        id: product.id, 
        sku: product.sku, 
        name: product.name,
        isHazardous: hazmatData?.isHazmat || false,
        unNumber: hazmatData?.unNumber || null,
      },
      classification: {
        id: classificationId,
        nmfcCode: nmfc_full,
        freightClass,
        description: description || hazmatData?.properShippingName || null,
        isHazmat: hazmatData?.isHazmat || false,
        hazmatClass: hazmatData?.hazardClass || null,
        packingGroup: hazmatData?.packingGroup || null,
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
