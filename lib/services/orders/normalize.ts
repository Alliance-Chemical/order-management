export interface OrderItemLike {
  sku?: string | null;
  name?: string | null;
  unitPrice?: number | null;
  [key: string]: any;
}

// Centralized filter to exclude non-physical/discount lines
// Rules:
// - Any negative `unitPrice` is excluded
// - Names containing common discount markers are excluded (discount, welcome)
// - Lines with no SKU that look like adjustments are excluded
const DISCOUNT_MARKERS = ['discount', 'welcome'];

export function isDiscountLine(item: OrderItemLike): boolean {
  const name = (item.name || '').toString().toLowerCase();
  const sku = (item.sku || '').toString().toLowerCase();
  const unitPrice = Number(item.unitPrice ?? 0);

  if (Number.isFinite(unitPrice) && unitPrice < 0) return true;

  if (DISCOUNT_MARKERS.some((m) => name.includes(m))) return true;

  // Some platforms encode discounts in SKU too
  if (DISCOUNT_MARKERS.some((m) => sku.includes(m))) return true;

  // Generic adjustments without SKU that look like non-physical lines
  const hasNoSku = !item.sku || item.sku === '';
  if (hasNoSku && (name.includes('coupon') || name.includes('promo') || name.includes('adjust'))) {
    return true;
  }

  return false;
}

export function filterOutDiscounts<T extends OrderItemLike>(items: T[] | undefined | null): T[] {
  if (!items || !Array.isArray(items)) return [] as T[];
  return items.filter((item) => !isDiscountLine(item));
}

