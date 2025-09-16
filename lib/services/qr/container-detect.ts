export type ContainerMatch =
  | { type: 'drum' | 'tote' | 'carboy' | 'ibc'; labels: number }
  | { type: 'freight-case' | 'freight-pail' | 'freight-box' | 'freight-gallon' | 'container'; labels: number };

// Deterministic ordered matcher:
// drum → tote → carboy → ibc → case → pail → box → gallon
export function detectContainer(itemName: string, sku: string | undefined, qty: number): ContainerMatch {
  const name = (itemName || '').toLowerCase();
  const skuL = (sku || '').toLowerCase();

  // Large containers: 1 label per physical container (qty)
  if (name.includes('drum') || skuL.includes('drum')) return { type: 'drum', labels: Math.max(1, qty) };
  if (name.includes('tote') || skuL.includes('tote')) return { type: 'tote', labels: Math.max(1, qty) };
  if (name.includes('carboy') || skuL.includes('carboy')) return { type: 'carboy', labels: Math.max(1, qty) };
  if (name.includes('ibc') || name.includes('intermediate bulk') || skuL.includes('ibc')) return { type: 'ibc', labels: Math.max(1, qty) };

  // Freight groupings: default to 1 freight label per line
  if (name.includes('case') || name.includes('pack') || name.includes('kit')) {
    return { type: 'freight-case', labels: Math.max(1, qty) };
  }
  if (name.includes('pail')) {
    return { type: 'freight-pail', labels: Math.max(1, qty) };
  }
  if (name.includes('box') || skuL.includes('box')) {
    return { type: 'freight-box', labels: Math.max(1, qty) };
  }

  // Gallon is guarded by not matching above terms
  if (name.includes('gallon') || name.includes('gal')) {
    return { type: 'freight-gallon', labels: Math.max(1, qty) };
  }

  // Fallback: one label per each small container
  return { type: 'container', labels: Math.max(1, qty) };
}
