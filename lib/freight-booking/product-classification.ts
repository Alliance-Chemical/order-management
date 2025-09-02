import { getEdgeSql } from '@/lib/db/neon-edge';

export type ApprovedClassification = {
  nmfcCode: string | null;
  freightClass: string;
  isHazmat: boolean;
  hazmatClass?: string | null;
  packingGroup?: string | null;
  unNumber?: string | null;
  description?: string | null;
};

export async function getApprovedClassificationBySku(sku: string): Promise<ApprovedClassification | null> {
  const sql = getEdgeSql();
  const rows = await sql`
    SELECT 
      fc.nmfc_code, fc.freight_class, fc.is_hazmat,
      fc.hazmat_class, fc.packing_group,
      p.un_number,
      fc.description as classification_description
    FROM products p
    JOIN product_freight_links pfl ON p.id = pfl.product_id
    JOIN freight_classifications fc ON pfl.classification_id = fc.id
    WHERE p.sku = ${sku} AND pfl.is_approved = true
    LIMIT 1
  ` as any[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    nmfcCode: r.nmfc_code || null,
    freightClass: r.freight_class,
    isHazmat: r.is_hazmat,
    hazmatClass: r.hazmat_class,
    packingGroup: r.packing_group,
    unNumber: r.un_number,
    description: r.classification_description,
  };
}

