function tokenize(text) {
  return text.split(/\s+/).filter(Boolean);
}

function chunkText(text, opts = {}) {
  const tokens = tokenize(text);
  const target = opts.targetTokens || 300;
  const overlap = opts.overlapTokens || Math.floor(target * 0.1);
  if (tokens.length <= target) return [text.trim()];
  const chunks = [];
  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(tokens.length, start + target);
    chunks.push(tokens.slice(start, end).join(' '));
    if (end === tokens.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.map((c) => c.trim()).filter(Boolean);
}

module.exports = { chunkText };

