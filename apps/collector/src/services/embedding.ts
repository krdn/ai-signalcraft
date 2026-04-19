/**
 * 임베딩 서비스 — multilingual-e5-small (384차원).
 *
 * 선택 근거:
 *   - raw_items.embedding이 vector(384)로 고정
 *   - 한국어·영어 혼합 corpus에 적합
 *   - CPU로도 실용적 속도 (~100 items/초)
 *   - @xenova/transformers = 순수 JS, 외부 서비스 의존 없음
 *
 * E5 모델은 입력에 prefix를 요구한다:
 *   - 저장(문서): "passage: <text>"
 *   - 쿼리(검색): "query: <text>"
 */

type FeatureExtractionPipeline = (
  inputs: string | string[],
  options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[]; tolist(): number[][] }>;

let _pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!_pipelinePromise) {
    _pipelinePromise = (async () => {
      // dynamic import — tsx/node ESM 호환
      const { pipeline } = await import('@xenova/transformers');
      const p = (await pipeline('feature-extraction', 'Xenova/multilingual-e5-small')) as unknown;
      return p as FeatureExtractionPipeline;
    })();
  }
  return _pipelinePromise;
}

/**
 * 문서 임베딩 — raw_items 저장용.
 */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const prefixed = texts.map((t) => `passage: ${t}`);
  const output = await pipe(prefixed, { pooling: 'mean', normalize: true });
  // 다중 입력이면 [[...], [...]], 단일이면 [...] — tolist()로 평탄화
  const list = output.tolist();
  return list;
}

/**
 * 쿼리 임베딩 — items.query의 RAG 모드에서 사용.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(`query: ${text}`, { pooling: 'mean', normalize: true });
  const list = output.tolist();
  return Array.isArray(list[0]) ? (list[0] as number[]) : (list as unknown as number[]);
}

/**
 * title + content를 결합해 임베딩 입력 텍스트 생성.
 * 너무 길면 앞부분만 — E5는 512 토큰 제한.
 */
export function buildEmbeddingText(title: string | null, content: string | null): string {
  const parts = [title, content].filter(Boolean) as string[];
  const combined = parts.join('\n\n');
  return combined.slice(0, 2000); // 대략 500~600 토큰
}
