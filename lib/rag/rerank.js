function parsePercents(s) {
  const res = [];
  const re = /(\d{1,3})(?:\.(\d+))?\s*(?:%|percent)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const val = parseFloat(`${m[1]}${m[2] ? '.' + m[2] : ''}`);
    if (!Number.isNaN(val)) res.push(val);
  }
  return res;
}

function numericAffinity(query, text) {
  const qs = parsePercents(query);
  const ts = parsePercents(text);
  if (!qs.length || !ts.length) return 0;
  let best = 0;
  for (const q of qs) {
    for (const t of ts) {
      const diff = Math.abs(q - t);
      const score = Math.max(0, 1 - diff / 50); // 0 at 50% apart, 1 when exact
      if (score > best) best = score;
    }
  }
  return best;
}

function extractIntervals(text) {
  const s = text.toLowerCase();
  const intervals = [];
  // at least A but not more than B
  let m = /at least\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)[^%]*?not more than\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)/.exec(s);
  if (m) intervals.push({ min: parseFloat(m[1]), max: parseFloat(m[2]), inclMin: true, inclMax: true });
  // with not more than A percent
  m = /not more than\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)/.exec(s);
  if (m) intervals.push({ min: -Infinity, max: parseFloat(m[1]), inclMin: false, inclMax: true });
  // with more than A percent
  m = /more than\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)/.exec(s);
  if (m) intervals.push({ min: parseFloat(m[1]), max: Infinity, inclMin: false, inclMax: false });
  // exactly X percent
  m = /(?:exactly|with)\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)/.exec(s);
  if (m) {
    const v = parseFloat(m[1]);
    intervals.push({ min: v, max: v, inclMin: true, inclMax: true });
  }
  return intervals;
}

function inInterval(v, intv) {
  const above = intv.inclMin ? v >= intv.min : v > intv.min;
  const below = intv.inclMax ? v <= intv.max : v < intv.max;
  return above && below;
}

function distanceToInterval(v, intv) {
  // Inside inclusive bounds -> 0
  if (inInterval(v, intv)) return 0;
  // Exactly at an open bound -> treat as small positive distance
  if (!intv.inclMin && v === intv.min) return 40; // strong penalty at open bound
  if (!intv.inclMax && v === intv.max) return 40;
  if (v < intv.min) return intv.min - v;
  if (v > intv.max) return v - intv.max;
  return 0; // default
}

function intervalAffinity(query, text) {
  const qs = parsePercents(query);
  const intervals = extractIntervals(text);
  if (!qs.length || !intervals.length) return 0;
  let best = 0;
  for (const q of qs) {
    for (const it of intervals) {
      if (inInterval(q, it)) return 1; // in-range match highest
      const dist = distanceToInterval(q, it);
      best = Math.max(best, Math.max(0, 1 - dist / 50));
    }
  }
  return best;
}

function localRerank(queryText, scored, weights = { interval: 0.35, numeric: 0.15 }) {
  const q = (queryText || '').toLowerCase();
  const wantsRFNA = /red\s+fuming|rfna/.test(q);
  const wantsOleum = /oleum|fuming\s+sulfuric/.test(q);
  return scored
    .map((r) => {
      const na = numericAffinity(queryText, r.doc.text || '');
      const ia = intervalAffinity(queryText, r.doc.text || '');
      let delta = (weights.numeric * na) + (weights.interval * ia);
      const t = (r.doc.text || '').toLowerCase();
      if (wantsRFNA) {
        if (/red\s+fuming/.test(t)) delta += 0.6;
        if (/other than red fuming/.test(t)) delta -= 0.5;
      }
      if (wantsOleum) {
        if (/oleum|fuming/.test(t)) delta += 0.4;
        if (/not\s+fuming|with not more than 51%/.test(t)) delta -= 0.2;
      }
      return { ...r, score: r.score + delta, rerank_bonus: delta };
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = { localRerank };
