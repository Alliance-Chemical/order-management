import { NextRequest, NextResponse } from 'next/server';
import { getEdgeSql, withEdgeRetry } from '@/lib/db/neon-edge';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Body = {
  productId?: string;
  sku?: string;
  isHazmat?: boolean;
  unNumber?: string;
  hazardClass?: string;
  packingGroup?: string;
  properShippingName?: string;
  approve?: boolean; // default true
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
};

export async function POST(request: NextRequest) {
  try {
    const sql = getEdgeSql();
    const body = (await request.json()) as Body;

    const {
      productId,
      sku,
      isHazmat,
      unNumber,
      hazardClass,
      packingGroup,
      properShippingName,
      approve = true,
    } = body;

    if (!productId && !sku) {
      return NextResponse.json({ success: false, error: 'Provide productId or sku' }, { status: 400 });
    }

    // Resolve product
    const productRows = await withEdgeRetry(async () => {
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
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    const product = productRows[0];

    // Upsert override by product id
    await withEdgeRetry(async () => {
      await sql`
        INSERT INTO product_hazmat_overrides (
          id, product_id, is_hazmat, un_number, hazard_class, packing_group, proper_shipping_name,
          is_approved, approved_by, approved_at, created_at, created_by, updated_at, updated_by
        ) VALUES (
          gen_random_uuid(),
          ${product.id}, ${isHazmat ?? null}, ${unNumber ?? null}, ${hazardClass ?? null}, ${packingGroup ?? null}, ${properShippingName ?? null},
          ${approve}, ${approve ? 'api/products/hazmat-override' : null}, ${approve ? sql`NOW()` : null}, NOW(), 'api/products/hazmat-override', NOW(), 'api/products/hazmat-override'
        )
        ON CONFLICT (product_id) DO UPDATE SET
          is_hazmat = EXCLUDED.is_hazmat,
          un_number = EXCLUDED.un_number,
          hazard_class = EXCLUDED.hazard_class,
          packing_group = EXCLUDED.packing_group,
          proper_shipping_name = EXCLUDED.proper_shipping_name,
          is_approved = EXCLUDED.is_approved,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = NOW(),
          updated_by = 'api/products/hazmat-override'
      `;
    });

    return NextResponse.json({
      success: true,
      product: { id: product.id, sku: product.sku, name: product.name },
      override: { isHazmat, unNumber, hazardClass, packingGroup, properShippingName, isApproved: approve },
    });
  } catch (error) {
    console.error('hazmat-override error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save hazmat override' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST to save hazmat override per SKU (variant)',
    example: {
      sku: 'ABC-123',
      isHazmat: true,
      unNumber: '1993',
      hazardClass: '3',
      packingGroup: 'II',
      properShippingName: 'Flammable liquids, n.o.s.',
      approve: true,
    },
  });
}
