const path = require('path');
const { loadIndex, search } = require('../lib/rag/vectorStore');
const { embed } = require('../lib/rag/embeddings');
const { localRerank } = require('../lib/rag/rerank');

async function run(query, filters) {
  const idx = await loadIndex(path.join(process.cwd(), 'data', 'index-hmt-local.json'));
  const [qvec] = await embed([query], { provider: 'local-hash', dim: idx.dim || 512 });
  const prelim = search(idx, qvec, { k: 20, queryText: query, alpha: 0.7, filters });
  const results = localRerank(query, prelim).slice(0, 5);
  for (const { score, vecSim, kw, doc, rerank_bonus } of results) {
    const m = doc.metadata || {};
    console.log(`${(score).toFixed(3)}  vec=${vecSim.toFixed(3)} kw=${kw.toFixed(3)} bonus=${(rerank_bonus||0).toFixed(3)}  ${m.id_number}  ${m.base_name}${m.qualifier ? ' — ' + m.qualifier : ''}`);
  }
}

const q = process.argv.slice(2).join(' ') || 'Nitric Acid 70%';
run(q).catch((e) => {
  console.error(e);
  process.exit(1);
});
