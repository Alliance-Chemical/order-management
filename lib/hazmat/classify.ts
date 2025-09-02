import fs from 'fs';
import path from 'path';

type Classification = {
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  packing_group: 'I' | 'II' | 'III' | 'NONE' | null;
  labels?: string;
  erg_guide?: string | null;
  citations?: any[];
  confidence: number;
  source: string;
  explanation?: string;
  packaging?: any;
  quantity_limitations?: any;
  vessel_stowage?: any;
  special_provisions?: any;
};

let cachedIndex: any | null = null;
let cachedErg: Record<string, string> | null = null;
let cachedHist: any[] | null = null;
let cachedHmtRows: any[] | null = null;

function loadJSON(p: string) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export async function classifyWithRAG(sku: string | null, productName: string): Promise<Classification> {
  function expandQuery(q: string): string {
    const s = q.toLowerCase();
    const synonyms: Record<string, string[]> = {
      'nitric acid': ['aqua fortis', 'rfna', 'red fuming nitric acid'],
      'sulfuric acid': ['oil of vitriol', 'oleum', 'fuming sulfuric acid'],
      'hydrochloric acid': ['muriatic acid'],
      'sodium hydroxide': ['caustic soda', 'lye'],
      'potassium hydroxide': ['caustic potash'],
      'ammonia': ['spirits of ammonia'],
      'acetic acid': ['vinegar'],
      'ethanol': ['ethyl alcohol', 'denatured alcohol'],
      'isopropyl alcohol': ['isopropanol', '2-propanol', 'ipa'],
      'kerosene': ['k-1', 'k1'],
      'hexane': ['hexanes', 'n-hexane'],
      'sodium hypochlorite': ['bleach', 'hypochlorite solution', 'liquid bleach'],
    };
    let extra: string[] = [];
    for (const [canon, alts] of Object.entries(synonyms)) {
      if (s.includes(canon) || alts.some(a => s.includes(a))) {
        extra.push([canon, ...alts].join(' '));
      }
    }
    // If "proof" present, convert to approximate % abv and add to query to aid numeric match (e.g., 190 proof -> 95%)
    const proofMatch = q.match(/(\d{2,3})\s*proof/i);
    let proofPct = '';
    if (proofMatch) {
      const proofVal = parseInt(proofMatch[1], 10);
      if (!isNaN(proofVal)) {
        const pct = Math.round((proofVal / 2) * 10) / 10; // one decimal
        proofPct = ` ${pct}%`;
      }
    }
    return extra.length ? `${q}${proofPct} ${extra.join(' ')}` : `${q}${proofPct}`;
  }

  function detectGatingFilters(q: string): any | null {
    const s = (q || '').toLowerCase();
    const fam: Array<{ match: RegExp; baseRegex: string; classRegex?: string }> = [
      { match: /(\bnitric\b|aqua\s+fortis|rfna|red\s+fuming)/, baseRegex: 'nitric acid|nitrating acid' },
      { match: /(\bsulfuric\b|oleum|fuming\s+sulfuric|oil\s+of\s+vitriol)/, baseRegex: 'sulfuric acid|oleum' },
      { match: /(\bhydrochloric\b|muriatic)/, baseRegex: 'hydrochloric acid' },
      { match: /(\bacetic\b|vinegar)/, baseRegex: 'acetic acid' },
      { match: /(\bsodium\s+hydroxide\b|\blye\b|caustic\s+soda)/, baseRegex: 'sodium hydroxide' },
      { match: /(\bpotassium\s+hydroxide\b|caustic\s+potash)/, baseRegex: 'potassium hydroxide' },
      { match: /(\bhydrogen\s+peroxide\b)/, baseRegex: 'hydrogen peroxide' },
      { match: /(\bhypochlorite\b|bleach)/, baseRegex: 'hypochlorite solutions' },
      // Alcohol family (denatured ethanol)
      { match: /(denatured\s+alcohol|ethanol\b|ethyl\s+alcohol)/, baseRegex: 'ethanol|ethyl alcohol|alcohols, n\.o\.s\.', classRegex: '^3' },
      // Isopropyl alcohol
      { match: /(isopropyl\s+alcohol|isopropanol|2\-propanol|\bipa\b)/, baseRegex: 'isopropyl alcohol|isopropanol', classRegex: '^3' },
      // Petroleum family
      { match: /(petroleum|mineral\s+spirits|white\s+spirit|naphtha|naptha|vm&p|petroleum\s+ether|ligroin|hydrocarbon|paint\s+thinner)/,
        baseRegex: 'petroleum distillates|hydrocarbons, liquid|naphtha|white spirits', classRegex: '^3' },
      // Alkanes: hexane family
      { match: /(\bn-?hexane\b|\bhexanes?\b|\bheptane\b|\bpentane\b)/, baseRegex: 'hexane|hexanes|n-hexane', classRegex: '^3' },
      // Kerosene
      { match: /(\bkerosene\b|k\-?1\b)/, baseRegex: 'kerosene', classRegex: '^3' },
    ];
    for (const f of fam) {
      if (f.match.test(s)) {
        const filters: any = { base_name: { regex: f.baseRegex } };
        if (f.classRegex) filters.class = { regex: f.classRegex };
        return filters;
      }
    }
    return null;
  }

  function parsePercent(q: string): number | null {
    const m = (q || '').match(/(\d{1,3})(?:\.(\d+))?\s*%/);
    if (!m) return null;
    return parseFloat(m[0].replace(/%/, ''));
  }

  function nonHazardCheck(q: string): { nonhaz: boolean; reason: string } | null {
    const s = (q || '').toLowerCase();
    // Clear non-haz families (typical DOT): glycols, castor oil, glycerin
    if (/ethylene\s+glycol/.test(s)) return { nonhaz: true, reason: 'Ethylene glycol is typically not regulated for DOT' };
    if (/propylene\s+glycol/.test(s)) return { nonhaz: true, reason: 'Propylene glycol is typically not regulated for DOT' };
    if (/castor\s+oil/.test(s)) return { nonhaz: true, reason: 'Castor oil is typically not regulated for DOT' };
    if (/(vegetable\s+glycerin|glycerin|glycerol)/.test(s)) return { nonhaz: true, reason: 'Glycerin is typically not regulated for DOT' };
    if (/magnesium\s+chloride/.test(s)) return { nonhaz: true, reason: 'Magnesium chloride (incl. hexahydrate) is typically not regulated for DOT' };
    if (/magnesium\s+hydroxide/.test(s)) return { nonhaz: true, reason: 'Magnesium hydroxide is typically not regulated for DOT' };
    // Dilute acetic acid / vinegar thresholds
    if (/acetic\s+acid|vinegar/.test(s)) {
      const pct = parsePercent(q);
      if (pct !== null && pct <= 10) return { nonhaz: true, reason: `Acetic acid ${pct}% is not regulated for DOT` };
      if (/vinegar/.test(s) && (pct === null || pct <= 10)) return { nonhaz: true, reason: 'Vinegar is typically not regulated for DOT' };
    }
    // Hypochlorite/bleach threshold - ≤10% is non-regulated
    if (/(\bhypochlorite\b|bleach)/i.test(s)) {
      const pct = parsePercent(q);
      if (pct !== null && pct <= 10) return { nonhaz: true, reason: `Hypochlorite solution ${pct}% is not regulated for DOT (≤10% available chlorine)` };
    }
    return null;
  }
  const idxPath = path.join(process.cwd(), 'data', 'index-hmt-local.json');
  const ergPath = path.join(process.cwd(), 'data', 'erg-index.json');
  const histPath = path.join(process.cwd(), 'data', 'historical-shipping.json');
  const hmtRowsPath = path.join(process.cwd(), 'data', 'hmt-172101.json');

  try {
    if (!cachedIndex) cachedIndex = loadJSON(idxPath);
  } catch {
    return {
      un_number: null,
      proper_shipping_name: null,
      hazard_class: null,
      packing_group: null,
      confidence: 0.1,
      source: 'rag',
      explanation: 'HMT index missing. Run scripts/extract-hmt-from-cfr.js and scripts/build-hmt-index.js.',
    };
  }
  try { if (!cachedHmtRows) cachedHmtRows = loadJSON(hmtRowsPath); } catch {}

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { embed } = require('../rag/embeddings.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { search } = require('../rag/vectorStore.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { localRerank } = require('../rag/rerank.js');

  const nonhaz = nonHazardCheck(productName);
  if (nonhaz) {
    return {
      un_number: null,
      proper_shipping_name: null,
      hazard_class: null,
      packing_group: null,
      confidence: 0.95,
      source: 'rule-nonhaz',
      explanation: nonhaz.reason,
    };
  }

  // Direct rule-based mapping for common solvents/acids before embeddings
  if (cachedHmtRows && cachedHmtRows.length) {
    const direct = directMapToHMT(productName, cachedHmtRows);
    if (direct) return direct;
  }

  const expanded = expandQuery(productName);
  const [qvec] = await embed([expanded], { provider: 'auto', dim: cachedIndex.dim || 512 });
  const gating = detectGatingFilters(expanded);
  let prelim = search(cachedIndex, qvec, { k: 50, queryText: expanded, alpha: 0.5, filters: gating || undefined });
  if (!prelim.length && gating) {
    // Fallback to ungated if gating produced nothing
    prelim = search(cachedIndex, qvec, { k: 50, queryText: expanded, alpha: 0.5 });
  }
  let reranked = localRerank(productName, prelim).slice(0, 10);

  // Heuristic overrides for tricky families
  const ql = productName.toLowerCase();
  // Prefer Ethyl acetate explicitly when present
  if (/(ethyl\s+acetate|ethyl\s+ethanoate|\betoac\b|acetic\s+acid\s+ethyl\s+ester)/i.test(productName)) {
    const ea = reranked.find(r => (r.doc.metadata?.base_name || '').toLowerCase() === 'ethyl acetate');
    if (ea) reranked = [ea, ...reranked.filter(r => r !== ea)];
  }
  // Prefer Hexanes when hexane family present
  if (/(\bn-?hexane\b|\bhexanes?\b)/i.test(productName)) {
    const hx = reranked.find(r => /hexane/i.test(r.doc.metadata?.base_name || ''));
    if (hx) reranked = [hx, ...reranked.filter(r => r !== hx)];
  }
  // For sulfuric drain cleaners with unknown %, prefer >51% (UN1830)
  if (/sulfuric/i.test(productName) && /drain/i.test(productName)) {
    const s1830 = reranked.find(r => r.doc.metadata?.id_number === 'UN1830' || /more than 51%/i.test(r.doc.text || ''));
    if (s1830) reranked = [s1830, ...reranked.filter(r => r !== s1830)];
  }
  if (reranked.length === 0) {
    return {
      un_number: null,
      proper_shipping_name: null,
      hazard_class: null,
      packing_group: null,
      confidence: 0.1,
      source: 'rag',
      explanation: 'No close match in CFR HMT',
    };
  }

  const top = reranked[0].doc;
  const meta = top.metadata || {};

  try { if (!cachedErg) cachedErg = loadJSON(ergPath); } catch {}
  try { if (!cachedHist) cachedHist = loadJSON(histPath); } catch {}

  const ergGuide = cachedErg ? cachedErg[meta.id_number] || null : null;
  let historyCount = 0;
  if (cachedHist) {
    const needle = (productName || '').toLowerCase();
    historyCount = cachedHist.filter((h: any) =>
      (sku && h.sku === sku) ||
      (h.product_name && String(h.product_name).toLowerCase().includes(needle))
    ).filter((h: any) => h.chosen_un && h.chosen_un.toUpperCase() === meta.id_number).length;
  }

  const baseScore = (reranked[0] as any).score || 0.5;
  let confidence = Math.max(0.3, Math.min(0.99, 0.6 + (baseScore - 0.5) * 0.8 + (historyCount > 0 ? 0.1 : 0)));
  // Heuristic confidence floors for exact families
  const qLower = productName.toLowerCase();
  if ((/ethyl\s+acetate|ethyl\s+ethanoate|\betoac\b|acetic\s+acid\s+ethyl\s+ester/i).test(productName) && meta.base_name?.toLowerCase() === 'ethyl acetate') {
    confidence = Math.max(confidence, 0.8);
  }
  if ((/denatured\s+alcohol|ethyl\s+alcohol|ethanol/i).test(productName) && (/proof/i).test(productName) && (/^UN(1170|1987)$/.test(meta.id_number || ''))) {
    confidence = Math.max(confidence, 0.8);
  }
  if ((/sulfuric/i).test(productName) && (/drain/i).test(productName) && (meta.id_number === 'UN1830')) {
    confidence = Math.max(confidence, 0.75);
  }
  if ((/\bn-?hexane\b|\bhexanes?\b/i).test(productName) && /hexane/i.test(meta.base_name || '')) {
    confidence = Math.max(confidence, 0.8);
  }

  const explanation = [
    `Matched '${productName}' to '${meta.base_name}${meta.qualifier ? ' — ' + meta.qualifier : ''}' in 49 CFR 172.101 (HMT).`,
    meta.qualifier ? 'Concentration/qualifier aligned via numeric-aware reranker.' : null,
    ergGuide ? `ERG Guide ${ergGuide} added for emergency reference.` : null,
    historyCount > 0 ? `Historical shipments confirm ${historyCount} prior use of ${meta.id_number}.` : null,
  ].filter(Boolean).join(' ');

  const pg = (meta.packing_group || '').toUpperCase();
  const normalizedPG = (pg === 'I' || pg === 'II' || pg === 'III') ? pg as 'I'|'II'|'III' : pg ? 'NONE' : null;

  return {
    un_number: meta.id_number || null,
    proper_shipping_name: `${meta.base_name}${meta.qualifier ? ' — ' + meta.qualifier : ''}`,
    hazard_class: meta.class || meta.class_or_division || null,
    packing_group: normalizedPG,
    labels: Array.isArray(meta.label_codes) ? meta.label_codes.join(', ') : (top.text || '').match(/Labels ([^—]+)/)?.[1]?.trim(),
    // enrich with full CFR cell metadata
    packaging: meta.packaging,
    quantity_limitations: meta.quantity_limitations,
    vessel_stowage: meta.vessel_stowage,
    special_provisions: meta.special_provisions,
    erg_guide: ergGuide,
    citations: [
      { type: 'CFR', ref: '49 CFR 172.101', entry: { id_number: meta.id_number, base_name: meta.base_name, qualifier: meta.qualifier } },
      ergGuide ? { type: 'ERG', ref: 'ERG 2024', guide: ergGuide } : null,
    ].filter(Boolean),
    confidence,
    source: 'cfr-hmt',
    explanation,
  };
}

function directMapToHMT(productName: string, rows: any[]): Classification | null {
  const s = productName.toLowerCase();
  const pct = ((): number | null => {
    const m = s.match(/(\d{1,3})(?:\.(\d+))?\s*%/);
    if (!m) return null; return parseFloat(m[0]);
  })();
  const proof = ((): number | null => {
    const m = s.match(/(\d{2,3})\s*proof/);
    if (!m) return null; const v = parseInt(m[1], 10); return isNaN(v) ? null : v;
  })();

  function pickByBaseName(regex: RegExp): any | null {
    const cands = rows.filter(r => regex.test((r.base_name || '').toLowerCase()));
    return cands[0] || null;
  }
  function pickByBaseNameAndPG(regex: RegExp, desiredPg: 'I'|'II'|'III'): any | null {
    const cands = rows.filter(r => regex.test((r.base_name || '').toLowerCase()) && String(r.packing_group||'').toUpperCase() === desiredPg);
    return cands[0] || null;
  }
  function build(r: any, note: string): Classification {
    const pg = String(r.packing_group || '').toUpperCase();
    const normalizedPG = (pg === 'I' || pg === 'II' || pg === 'III') ? (pg as any) : (pg ? 'NONE' : null);
    return {
      un_number: r.id_number || null,
      proper_shipping_name: r.qualifier ? `${r.base_name} — ${r.qualifier}` : r.base_name,
      hazard_class: r.class_or_division || null,
      packing_group: normalizedPG,
      labels: Array.isArray(r.label_codes) ? r.label_codes.join(', ') : undefined,
      erg_guide: null,
      citations: [{ type: 'CFR', ref: '49 CFR 172.101', entry: { id_number: r.id_number, base_name: r.base_name, qualifier: r.qualifier } }],
      confidence: 0.92,
      source: 'rule-direct',
      explanation: `Direct CFR match for ${note}`,
    };
  }

  // Ethyl acetate
  if (/(\bethyl\s+acetate\b|ethyl\s+ethanoate|\betoac\b|acetic\s+acid\s+ethyl\s+ester)/i.test(productName)) {
    const r = pickByBaseName(/\bethyl acetate\b/);
    if (r) return build(r, 'Ethyl acetate');
  }
  // Hexane family
  if (/(\bn-?hexane\b|\bhexanes?\b)/i.test(productName)) {
    const r = pickByBaseName(/\bhexane/);
    if (r) return build(r, 'Hexane family');
  }
  // Heptane
  if (/\bheptane\b/i.test(productName)) {
    const r = pickByBaseName(/\bheptane/);
    if (r) return build(r, 'Heptane');
  }
  // Pentane
  if (/\bpentane\b/i.test(productName)) {
    const r = pickByBaseName(/\bpentane/);
    if (r) return build(r, 'Pentane');
  }
  // Hydrochloric acid / muriatic
  if (/(hydrochloric|muriatic)\s+acid/i.test(productName)) {
    const r = pickByBaseName(/hydrochloric acid/);
    if (r) return build(r, 'Hydrochloric acid');
  }
  // Ferric chloride mapping: default to solution when % present or "solution" in name; else anhydrous
  if (/ferric\s+chloride/i.test(productName)) {
    if (/anhydrous/i.test(productName)) {
      const r = pickByBaseName(/ferric chloride, anhydrous/);
      if (r) return build(r, 'Ferric chloride, anhydrous');
    }
    // percent or "solution" implies solution
    if (pct !== null || /solution/i.test(productName)) {
      const r = pickByBaseName(/ferric chloride, solution/);
      if (r) return build(r, `Ferric chloride solution${pct !== null ? ' ' + pct + '%' : ''}`);
    }
    // fallback to solution entry
    const r = pickByBaseName(/ferric chloride, solution/);
    if (r) return build(r, 'Ferric chloride solution');
  }
  // Sulfuric drain cleaner (assume >51% if unspecified)
  if (/sulfuric/i.test(productName) && /drain/i.test(productName)) {
    const r = rows.find(x => /sulfuric acid/i.test(x.base_name || '') && /more than 51%/i.test(x.qualifier || '')) || pickByBaseName(/sulfuric acid/);
    if (r) return build(r, 'Sulfuric acid drain cleaner');
  }
  // Ethanol / Denatured alcohol
  if (/(denatured\s+alcohol|ethanol\b|ethyl\s+alcohol)/i.test(productName)) {
    // If denatured, prefer Alcohols, n.o.s.; else Ethanol
    if (/denatured/i.test(productName)) {
      const r = pickByBaseName(/alcohols, n\.o\.s\./);
      if (r) return build(r, 'Denatured alcohol');
    }
    const r = pickByBaseName(/\bethanol\b|ethyl alcohol/);
    if (r) return build(r, 'Ethanol');
  }
  // Methanol / Methyl alcohol
  if (/(\bmethanol\b|methyl\s+alcohol)/i.test(productName)) {
    const r = pickByBaseName(/\bmethanol\b/);
    if (r) return build(r, 'Methanol');
  }
  // MEK / 2-Butanone / Ethyl methyl ketone
  if (/(methyl\s+ethyl\s+ketone|\bmek\b|2\-butanone|ethyl\s+methyl\s+ketone)/i.test(productName)) {
    const r = pickByBaseName(/methyl ethyl ketone|2\-butanone/);
    if (r) return build(r, 'Methyl ethyl ketone (MEK)');
  }
  // Isopropyl alcohol / Isopropanol
  if (/(isopropyl\s+alcohol|isopropanol|2\-propanol|\bipa\b)/i.test(productName)) {
    const r = pickByBaseName(/isopropyl alcohol|isopropanol/);
    if (r) return build(r, 'Isopropyl alcohol');
  }
  // Kerosene
  if (/(\bkerosene\b|k\-?1\b)/i.test(productName)) {
    const r = pickByBaseName(/\bkerosene\b/);
    if (r) return build(r, 'Kerosene');
  }
  // Glycol Ether EE (EGEE)
  if (/glycol\s+ether\s+ee\b/i.test(productName)) {
    const r = pickByBaseName(/ethylene glycol monoethyl ether/);
    if (r) return build(r, 'Glycol Ether EE (EGEE)');
  }
  // Glycol Ether EE Acetate (EGEE Acetate)
  if (/glycol\s+ether\s+ee\s+acetate/i.test(productName)) {
    const r = pickByBaseName(/ethylene glycol monoethyl ether acetate/);
    if (r) return build(r, 'Glycol Ether EE Acetate');
  }
  // Hydrochloric acid with explicit % thresholds for PG
  if (/(hydrochloric|muriatic)\s+acid/i.test(productName) && pct !== null) {
    if (pct <= 20) {
      const r = pickByBaseNameAndPG(/hydrochloric acid/, 'III');
      if (r) return build(r, `Hydrochloric acid ${pct}% (PG III)`);
    } else {
      const r = pickByBaseNameAndPG(/hydrochloric acid/, 'II');
      if (r) return build(r, `Hydrochloric acid ${pct}% (PG II)`);
    }
  }
  // Sodium hypochlorite / bleach - maps to "Hypochlorite solutions" UN1791
  if (/(\bsodium\s+hypochlorite\b|\bhypochlorite\b|bleach)/i.test(productName)) {
    // Find "Hypochlorite solutions" entry which is UN1791
    const r = rows.find(x => /hypochlorite solutions/i.test(x.base_name || '') && x.id_number === 'UN1791');
    if (r) {
      // Determine packing group based on concentration
      // >20% available chlorine = PG II, 10-20% = PG III
      let pgOverride = r.packing_group;
      let qualifierText = '';
      if (pct !== null) {
        if (pct > 20) {
          pgOverride = 'II';
          qualifierText = ` (>${pct}% available chlorine)`;
        } else if (pct > 10) {
          pgOverride = 'III';
          qualifierText = ` (${pct}% available chlorine)`;
        }
      }
      const pg = String(pgOverride || '').toUpperCase();
      const normalizedPG = (pg === 'I' || pg === 'II' || pg === 'III') ? (pg as any) : (pg ? 'NONE' : null);
      return {
        un_number: 'UN1791',
        proper_shipping_name: `Hypochlorite solutions${qualifierText}`,
        hazard_class: '8', // Class 8 corrosive
        packing_group: normalizedPG,
        labels: '8',
        erg_guide: null,
        citations: [{ type: 'CFR', ref: '49 CFR 172.101', entry: { id_number: 'UN1791', base_name: 'Hypochlorite solutions', qualifier: qualifierText } }],
        confidence: 0.95,
        source: 'rule-direct',
        explanation: `Direct CFR match for Sodium hypochlorite/bleach${pct !== null ? ' ' + pct + '%' : ''}`,
      };
    }
  }
  return null;
}
