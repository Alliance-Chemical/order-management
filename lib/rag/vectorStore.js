const fs = require('fs');

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

function cosine(a, b) {
  return dot(a, b); // vectors should already be L2-normalized by our embedder
}

function keywordScore(text, query) {
  const qtoks = query.toLowerCase().split(/\W+/).filter(Boolean);
  const tt = text.toLowerCase();
  let hits = 0;
  for (const q of qtoks) if (q && tt.includes(q)) hits++;
  return hits / Math.max(1, qtoks.length);
}

function passesFilters(meta, filters) {
  if (!filters) return true;
  for (const [k, v] of Object.entries(filters)) {
    const mv = meta[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (!v.includes(mv)) return false;
    } else if (typeof v === 'object' && v !== null) {
      if (v.eq !== undefined && mv !== v.eq) return false;
      if (v.regex !== undefined && !(new RegExp(v.regex, 'i')).test(String(mv ?? ''))) return false;
    } else {
      if (mv !== v) return false;
    }
  }
  return true;
}

function saveIndex(path, index) {
  fs.writeFileSync(path, JSON.stringify(index, null, 2), 'utf8');
}

function loadIndex(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const idx = JSON.parse(raw);
  return idx;
}

function search(index, queryEmbedding, options = {}) {
  const k = options.k || 10;
  const filters = options.filters;
  const alpha = options.alpha ?? 0.7; // weight for vector vs keyword hybrid
  const queryText = options.queryText || '';
  const scored = [];
  for (const doc of index.docs) {
    if (!passesFilters(doc.metadata || {}, filters)) continue;
    const vecSim = cosine(queryEmbedding, doc.embedding);
    const kw = queryText ? keywordScore(doc.text || '', queryText) : 0;
    const score = alpha * vecSim + (1 - alpha) * kw;
    scored.push({ score, vecSim, kw, doc });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

module.exports = { saveIndex, loadIndex, search };

