import { getEdgeSql } from '@/lib/db/neon-edge';

export type HazmatOverride = {
  isHazmat?: boolean | null;
  unNumber?: string | null;
  hazardClass?: string | null;
  packingGroup?: string | null;
  properShippingName?: string | null;
};

type HazmatOverrideRow = {
  is_hazmat: boolean | null;
  un_number: string | null;
  hazard_class: string | null;
  packing_group: string | null;
  proper_shipping_name: string | null;
};

export async function getHazmatOverrideBySku(sku: string): Promise<HazmatOverride | null> {
  const sql = getEdgeSql();
  const rows = await sql`
    SELECT pho.is_hazmat, pho.un_number, pho.hazard_class, pho.packing_group, pho.proper_shipping_name
    FROM products p
    JOIN product_hazmat_overrides pho ON pho.product_id = p.id
    WHERE p.sku = ${sku} AND pho.is_approved = true
    LIMIT 1
  ` as HazmatOverrideRow[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    isHazmat: r.is_hazmat,
    unNumber: r.un_number,
    hazardClass: r.hazard_class,
    packingGroup: r.packing_group,
    properShippingName: r.proper_shipping_name,
  };
}
