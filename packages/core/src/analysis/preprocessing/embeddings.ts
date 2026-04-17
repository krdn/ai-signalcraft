/**
 * E5-small 임베딩 생성 + Redis 캐시 + 코사인 유사도.
 *
 * 성능 개선 포인트:
 *   1. 진짜 배치 호출 (extractor가 배열을 받아 내부 배치 텐서 연산)
 *   2. ONNX Runtime 멀티스레드 활성화 (4 threads)
 *   3. SHA-256 키 기반 Redis 캐시 (동일 텍스트 재임베딩 방지)
 */
import { createHash } from 'node:crypto';
import { cacheGet, cacheSet } from '../../cache/redis-cache';

let pipelineInstance: any = null;
let initPromise: Promise<any> | null = null;

const EMBED_BATCH_SIZE = 32;
const EMBED_CACHE_TTL_SEC = 86400 * 7; // 7일

async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const transformers = await import('@xenova/transformers');
    // 캐시 경로를 고정하여 Docker 볼륨 마운트와 일치시킴
    transformers.env.cacheDir = `${process.env.HOME ?? '/root'}/.cache/xenova`;
    // ONNX Runtime 멀티스레드 (기본 1 → 4)
    if (transformers.env.backends?.onnx?.wasm) {
      transformers.env.backends.onnx.wasm.numThreads = 4;
    }
    pipelineInstance = await transformers.pipeline(
      'feature-extraction',
      'Xenova/multilingual-e5-small',
    );
    return pipelineInstance;
  })();

  return initPromise;
}

function embedCacheKey(text: string): string {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 24);
  return `embed:e5:${hash}`;
}

/**
 * 텍스트 배열을 임베딩으로 변환.
 * - Redis에서 캐시 조회 후 미캐시 텍스트만 추론
 * - 진짜 배치 호출로 텐서 연산 활용
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  // 1. 캐시 조회 (병렬)
  const cacheKeys = texts.map(embedCacheKey);
  const cached = await Promise.all(cacheKeys.map((k) => cacheGet<number[]>(k).catch(() => null)));

  for (let i = 0; i < texts.length; i++) {
    if (cached[i] && Array.isArray(cached[i]) && cached[i]!.length > 0) {
      results[i] = cached[i]!;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  // 2. 미캐시 텍스트만 추론 (진짜 배치)
  if (uncachedTexts.length > 0) {
    const extractor = await getEmbeddingPipeline();

    for (let i = 0; i < uncachedTexts.length; i += EMBED_BATCH_SIZE) {
      const batch = uncachedTexts.slice(i, i + EMBED_BATCH_SIZE);
      // extractor는 문자열 배열을 받아 (batch_size, seq_len, hidden) 텐서 반환
      // pooling:'mean' + normalize:true 로 (batch_size, hidden) 벡터 획득
      const output = await extractor(batch, { pooling: 'mean', normalize: true });

      // transformers.js는 단일 입력과 배치 입력의 반환 형식이 다르다.
      // 배치 입력이어도 output.data는 평탄화된 Float32Array (batch * hidden) 하나.
      const hiddenSize = output.dims[output.dims.length - 1];
      const dataArray = output.data as Float32Array;

      for (let j = 0; j < batch.length; j++) {
        const vec = Array.from(dataArray.subarray(j * hiddenSize, (j + 1) * hiddenSize));
        const globalIdx = uncachedIndices[i + j];
        results[globalIdx] = vec;
        // 캐시 저장 (await 불필요)
        cacheSet(cacheKeys[globalIdx], vec, EMBED_CACHE_TTL_SEC).catch(() => undefined);
      }
    }
  }

  return results as number[][];
}

/** 코사인 유사도 (이미 정규화된 벡터 기준 — 사실상 내적) */
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
