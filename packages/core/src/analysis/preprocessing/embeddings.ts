let pipelineInstance: any = null;

async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;

  const { pipeline } = await import('@xenova/transformers');
  pipelineInstance = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  return pipelineInstance;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const results: number[][] = [];

  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    for (const text of batch) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      results.push(Array.from(output.data as Float32Array));
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
