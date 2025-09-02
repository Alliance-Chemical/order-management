// Embedding providers: auto-selects best available (OpenAI, Google, Voyage, Cohere),
// falls back to a lightweight local embedding if no keys or network blocked.
// All providers return L2-normalized vectors.

// Lightweight local embedding: character n-gram hashing + L2 normalization
function hashingVector(text, dim = 512, ngram = 3) {
  const vec = new Float32Array(dim);
  const s = ` ${text.toLowerCase()} `;
  for (let i = 0; i < s.length - ngram + 1; i++) {
    const gram = s.slice(i, i + ngram);
    let h = 2166136261; // FNV-1a
    for (let j = 0; j < gram.length; j++) {
      h ^= gram.charCodeAt(j);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return Array.from(vec);
}

async function embedOpenAI(texts, model = 'text-embedding-3-large') {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => l2normalize(d.embedding));
}

async function embedGoogle(texts, model = 'text-embedding-004') {
  const key = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI API key not set');
  if (texts.length === 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: texts[0] }] } }),
    });
    if (!res.ok) throw new Error(`Google embeddings error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return [l2normalize(data.embedding.values)];
  } else {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:batchEmbedContents?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((t) => ({ content: { parts: [{ text: t }] } })),
      }),
    });
    if (!res.ok) throw new Error(`Google batch embeddings error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.embeddings.map((e) => l2normalize(e.values));
  }
}

async function embedVoyage(texts, model = 'voyage-large-2') {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => l2normalize(d.embedding));
}

async function embedCohere(texts, model = 'embed-english-v3.0') {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY not set');
  const res = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model, input_type: 'search_document' }),
  });
  if (!res.ok) throw new Error(`Cohere embeddings error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embeddings.map((v) => l2normalize(v));
}

function l2normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return vec.map((x) => x / norm);
}

async function embed(texts, options = {}) {
  const provider = options.provider || 'auto';
  const model = options.model; // optional override per provider
  try {
    // Env override for provider/model
    const envProvider = process.env.EMBED_PROVIDER && provider === 'auto' ? process.env.EMBED_PROVIDER : provider;
    const envModel = process.env.EMBED_MODEL || model;

    if (envProvider === 'openai') return await embedOpenAI(texts, envModel || 'text-embedding-3-large');
    if (envProvider === 'google') return await embedGoogle(texts, envModel || 'text-embedding-004');
    if (envProvider === 'voyage') return await embedVoyage(texts, envModel || 'voyage-large-2');
    if (envProvider === 'cohere') return await embedCohere(texts, envModel || 'embed-english-v3.0');
    if (envProvider === 'local-hash') {
      const dim = options.dim || 512;
      return texts.map((t) => hashingVector(t, dim));
    }
    if (provider === 'openai') return await embedOpenAI(texts, model || 'text-embedding-3-large');
    if (provider === 'google') return await embedGoogle(texts, model || 'text-embedding-004');
    if (provider === 'voyage') return await embedVoyage(texts, model || 'voyage-large-2');
    if (provider === 'cohere') return await embedCohere(texts, model || 'embed-english-v3.0');
    if (provider === 'local-hash') {
      const dim = options.dim || 512;
      return texts.map((t) => hashingVector(t, dim));
    }
    if (provider === 'auto') {
      // Prefer OpenAI, then Google, Voyage, Cohere, else local
      if (process.env.OPENAI_API_KEY) return await embedOpenAI(texts, 'text-embedding-3-large');
      if (process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY) return await embedGoogle(texts, 'text-embedding-004');
      if (process.env.VOYAGE_API_KEY) return await embedVoyage(texts, 'voyage-large-2');
      if (process.env.COHERE_API_KEY) return await embedCohere(texts, 'embed-english-v3.0');
      const dim = options.dim || 512;
      return texts.map((t) => hashingVector(t, dim));
    }
    throw new Error(`Embedding provider '${provider}' not configured.`);
  } catch (e) {
    // Fallback to local if network/key fails
    const dim = options.dim || 512;
    return texts.map((t) => hashingVector(t, dim));
  }
}

module.exports = { embed, hashingVector };
