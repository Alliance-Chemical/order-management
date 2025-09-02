export type DensitySuggestion = {
  nmfcCode: string; // e.g., '43940'
  nmfcSub: string;  // '1' | '2' | '3' | '4'
  freightClass: string; // '125' | '85' | '70' | '55'
  densityLbPerFt3: number;
  rationale: string;
};

export type PgSuggestion = {
  nmfcCode: string; // e.g., '44155'
  nmfcSub: string;  // '1' | '2' | '3'
  freightClass: string; // e.g., '92.5' | '85' | '70'
  rationale: string;
};

// Determine if an NMFC code is density-based according to simple rules we support.
export function isDensityBasedNmfc(nmfcCode?: string | null): boolean {
  const code = (nmfcCode || '').trim();
  return code === '43940';
}

// Suggest density bracket for NMFC 43940 (Chemicals, NOI) given total weight (lbs) and cubic feet.
export function suggestDensityFor43940(totalWeightLbs: number, cubicFeet: number): DensitySuggestion | null {
  if (!totalWeightLbs || !cubicFeet || cubicFeet <= 0) return null;
  const d = totalWeightLbs / cubicFeet;
  let nmfcSub = '';
  let freightClass = '';
  if (d < 10) {
    nmfcSub = '1';
    freightClass = '125';
  } else if (d < 15) {
    nmfcSub = '2';
    freightClass = '85';
  } else if (d < 30) {
    nmfcSub = '3';
    freightClass = '70';
  } else {
    nmfcSub = '4';
    freightClass = '55';
  }
  return {
    nmfcCode: '43940',
    nmfcSub,
    freightClass,
    densityLbPerFt3: Number(d.toFixed(2)),
    rationale: `Density ${d.toFixed(2)} lb/ft³ → 43940-${nmfcSub} (Class ${freightClass})`,
  };
}

// Suggest PG-based sub for codes where sub maps to PG (e.g., 44155 from industry references)
export function suggestSubFromPackingGroup(nmfcCode: string, packingGroup?: string | null): PgSuggestion | null {
  const code = (nmfcCode || '').trim();
  const pg = (packingGroup || '').trim().toUpperCase();
  if (!code || !pg) return null;
  if (code === '44155') {
    let nmfcSub = '';
    let freightClass = '';
    if (pg === 'I') { nmfcSub = '1'; freightClass = '92.5'; }
    else if (pg === 'II') { nmfcSub = '2'; freightClass = '85'; }
    else if (pg === 'III') { nmfcSub = '3'; freightClass = '70'; }
    else return null;
    return {
      nmfcCode: '44155',
      nmfcSub,
      freightClass,
      rationale: `PG ${pg} → 44155-${nmfcSub} (Class ${freightClass})`,
    };
  }
  return null;
}

