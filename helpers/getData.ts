// Stub implementations for freight data helpers until backend wiring is complete

export interface FreightClassificationRecord {
  classificationId: number;
  description: string;
  nmfc?: string;
  freightClass?: string;
  hazardId?: string;
  hazardous?: boolean;
  packingGroup?: string;
}

export async function checkSKUsForClassification(skus: string[]) {
  console.log('checkSKUsForClassification called with:', skus);
  return skus.map((sku) => ({ sku, hasClassification: true }));
}

export async function getFreightClassifications(): Promise<FreightClassificationRecord[]> {
  console.log('getFreightClassifications fallback invoked');
  return [];
}

export async function searchFreightClassifications(_query: string): Promise<FreightClassificationRecord[]> {
  console.log('searchFreightClassifications fallback invoked');
  return [];
}
