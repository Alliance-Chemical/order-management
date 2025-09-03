// OpenAI Embeddings Configuration for RAG System
// Using text-embedding-3-small for cost efficiency

const EMBEDDING_CONFIG = {
  // OpenAI's newest and most cost-effective model
  // $0.02 per 1M tokens (100x cheaper than text-embedding-ada-002)
  model: 'text-embedding-3-small',
  
  // Dimensions can be reduced for even more efficiency
  // 1536 = full dimensions (best quality)
  // 512 = good balance of quality and speed
  // 256 = fastest, still good for many use cases
  dimensions: 1536,
  
  // Batch size for API calls (OpenAI supports up to 2048 inputs per request)
  batchSize: 100,
  
  // Rate limiting (OpenAI has generous limits)
  requestsPerMinute: 3000,
  tokensPerMinute: 1000000,
};

// Helper to embed with OpenAI using optimal settings
async function embedWithOpenAI(texts) {
  const { embed } = require('./embeddings');
  
  // Use OpenAI with our optimized model
  return await embed(texts, {
    provider: 'openai',
    model: EMBEDDING_CONFIG.model,
    dimensions: EMBEDDING_CONFIG.dimensions
  });
}

// Batch processing for large datasets
async function embedBatch(texts, onProgress) {
  const results = [];
  const batchSize = EMBEDDING_CONFIG.batchSize;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await embedWithOpenAI(batch);
    results.push(...embeddings);
    
    if (onProgress) {
      onProgress({
        processed: Math.min(i + batchSize, texts.length),
        total: texts.length,
        percent: Math.round((Math.min(i + batchSize, texts.length) / texts.length) * 100)
      });
    }
    
    // Small delay to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Cost estimation helper
function estimateEmbeddingCost(texts) {
  // Rough estimate: average 50 tokens per text
  const estimatedTokens = texts.length * 50;
  const costPer1MTokens = 0.02; // $0.02 per 1M tokens
  const estimatedCost = (estimatedTokens / 1000000) * costPer1MTokens;
  
  return {
    texts: texts.length,
    estimatedTokens,
    estimatedCost: `$${estimatedCost.toFixed(4)}`,
    note: estimatedCost < 0.01 ? 'Less than 1 cent!' : undefined
  };
}

module.exports = {
  EMBEDDING_CONFIG,
  embedWithOpenAI,
  embedBatch,
  estimateEmbeddingCost
};