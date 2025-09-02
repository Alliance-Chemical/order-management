import { getEdgeSql } from '@/lib/db/neon-edge';

export type CFRHazmat = {
  isHazmat: boolean;
  unNumber: string | null;
  properShippingName?: string | null; // if available in your schema
  hazardClass?: string | null;        // if available in your schema
  packingGroup?: string | null;       // if available in your schema
};

// Pulls authoritative CFR-backed hazmat attributes from DB.
// Currently reads products.is_hazardous + products.un_number; extend as your schema grows.
export async function getCfrHazmatBySku(sku: string): Promise<CFRHazmat | null> {
  const sql = getEdgeSql();
  const rows = await sql`
    SELECT is_hazardous, un_number
    FROM products
    WHERE sku = ${sku}
    LIMIT 1
  ` as any[];

  if (!rows.length) return null;

  const r = rows[0];
  return {
    isHazmat: !!r.is_hazardous,
    unNumber: r.un_number || null,
    properShippingName: null,
    hazardClass: null,
    packingGroup: null,
  };
}

