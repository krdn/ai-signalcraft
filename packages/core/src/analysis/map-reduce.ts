// Map-Reduce 분석 파이프라인
// 대량 데이터(59K+ 토큰)를 청크로 분할하여 개별 분석(Map) 후 종합(Reduce)
// Context Rot 방지 + Rate Limit 완화 + 정확도 향상
import { analyzeStructured, type AIGatewayOptions } from '@ai-signalcraft/ai-gateway';
import { persistAnalysisResult } from './persist-analysis';
import { getModuleModelConfig } from './model-config';
import { runModule } from './runner';
import { isRateLimitError, parseRetryAfter, sleep, MAX_RATE_LIMIT_RETRIES } from './retry-utils';
import { getConcurrencyConfig } from './concurrency-config';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult } from './types';

// --- 청킹 설정 ---

interface MapReduceConfig {
  /** 청크 목표 크기 (문자 수). 기본 15,000자 ≈ 4K 토큰 */
  chunkTargetChars: number;
  /** 청킹 최소 데이터 크기. 이 이하면 단일 패스 */
  minCharsForChunking: number;
  /** Map 단계 API 타임아웃 (ms) */
  mapTimeoutMs: number;
  /** Reduce 단계 API 타임아웃 (ms) */
  reduceTimeoutMs: number;
}

const DEFAULT_CONFIG: MapReduceConfig = {
  chunkTargetChars: 15_000,
  minCharsForChunking: 20_000,
  mapTimeoutMs: 120_000,
  reduceTimeoutMs: 180_000,
};

// --- 데이터 크기 계산 ---

function estimateChars(input: AnalysisInput): number {
  let total = 0;
  for (const a of input.articles) {
    total += (a.title?.length ?? 0) + (a.content?.length ?? 0) + 50; // 메타데이터 여유
  }
  for (const v of input.videos) {
    total += (v.title?.length ?? 0) + 80;
  }
  for (const c of input.comments) {
    total += (c.content?.length ?? 0) + 30;
  }
  return total;
}

// --- 청킹 ---

/**
 * 분석 입력 데이터를 균등한 청크로 분할
 * 각 청크는 AnalysisInput과 동일한 구조 (keyword, dateRange 공유)
 * 데이터가 작으면 청크 1개 반환 (단일 패스)
 */
export function chunkAnalysisInput(
  input: AnalysisInput,
  config: Partial<MapReduceConfig> = {},
): AnalysisInput[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const totalChars = estimateChars(input);

  if (totalChars < cfg.minCharsForChunking) {
    return [input]; // 소규모 데이터 → 단일 패스
  }

  const numChunks = Math.max(2, Math.ceil(totalChars / cfg.chunkTargetChars));

  // 기사 라운드로빈 분배 (시간순 보존)
  const articleChunks: (typeof input.articles)[] = Array.from({ length: numChunks }, () => []);
  for (let i = 0; i < input.articles.length; i++) {
    articleChunks[i % numChunks].push(input.articles[i]);
  }

  // 댓글 균등 분배 (좋아요순 유지)
  const commentChunks: (typeof input.comments)[] = Array.from({ length: numChunks }, () => []);
  for (let i = 0; i < input.comments.length; i++) {
    commentChunks[i % numChunks].push(input.comments[i]);
  }

  // 영상 균등 분배
  const videoChunks: (typeof input.videos)[] = Array.from({ length: numChunks }, () => []);
  for (let i = 0; i < input.videos.length; i++) {
    videoChunks[i % numChunks].push(input.videos[i]);
  }

  return Array.from({ length: numChunks }, (_, i) => ({
    jobId: input.jobId,
    keyword: input.keyword,
    articles: articleChunks[i],
    videos: videoChunks[i],
    comments: commentChunks[i],
    dateRange: input.dateRange,
  }));
}

// --- Rate limit 재시도 래퍼 ---

async function callWithRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfterSec = parseRetryAfter(error);
        const backoffMs = Math.max(retryAfterSec * 1000, (attempt + 1) * 3000);
        console.log(`[map-reduce] ${label}: rate limit, ${backoffMs}ms 후 재시도 (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// --- Reduce 프롬프트 생성 ---

function buildReducePrompt(
  module: AnalysisModule,
  keyword: string,
  chunkResults: unknown[],
  totalChunks: number,
): string {
  const resultsJson = chunkResults
    .map((r, i) => `### 청크 ${i + 1}/${totalChunks} 분석 결과\n${JSON.stringify(r, null, 2)}`)
    .join('\n\n');

  return `당신은 여론 분석 결과를 종합하는 전문가입니다.

"${keyword}"에 대한 "${module.displayName}" 분석이 ${totalChunks}개 데이터 청크로 나뉘어 개별 수행되었습니다.
아래는 각 청크의 분석 결과입니다. 이를 하나의 통합 결과로 종합하세요.

## 종합 지침
- 배열 항목은 중복을 제거하고 병합하세요
- 수치(비율, 점수)는 청크 크기를 고려한 가중 평균으로 계산하세요
- 전체 데이터를 보는 관점에서 요약과 방향성을 재작성하세요
- 누락 없이 모든 청크의 인사이트를 반영하세요

## 청크별 분석 결과
${resultsJson}

위 ${totalChunks}개 청크 결과를 하나의 통합 분석으로 종합하세요.`;
}

// --- Map-Reduce 실행 ---

/**
 * Map-Reduce로 분석 모듈 실행
 * 데이터가 작으면 기존 runModule()로 위임 (단일 패스)
 */
export async function runModuleMapReduce<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
): Promise<AnalysisModuleResult<T>> {
  const cfg = DEFAULT_CONFIG;
  const chunks = chunkAnalysisInput(input);

  // 청크 1개 = 소규모 데이터 → 기존 단일 패스
  if (chunks.length === 1) {
    return runModule(module, input, priorResults);
  }

  console.log(`[map-reduce] ${module.name}: ${chunks.length}개 청크로 Map-Reduce 실행 (총 기사=${input.articles.length}, 댓글=${input.comments.length})`);

  try {
    // DB에 running 상태 기록
    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'running',
    });

    const config = await getModuleModelConfig(module.name);
    const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // === MAP 단계 (프로바이더별 동시성 제한 병렬 처리) ===
    const mapResults: { result: T; chunkIndex: number }[] = [];

    const cc = await getConcurrencyConfig();
    const mapConcurrency = cc.providerConcurrency[config.provider] ?? 2;
    console.log(`[map-reduce] ${module.name}: Map 동시성=${mapConcurrency} (${config.provider})`);

    for (let i = 0; i < chunks.length; i += mapConcurrency) {
      const batch = chunks.slice(i, i + mapConcurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (chunk, batchIdx) => {
          const chunkIdx = i + batchIdx;
          const chunkLabel = `${module.name}[chunk ${chunkIdx + 1}/${chunks.length}]`;

          const prompt = module.buildPrompt(chunk);
          const mapPrompt = `[데이터 청크 ${chunkIdx + 1}/${chunks.length}] 전체 수집 데이터 중 일부입니다. 이 부분의 데이터만 분석하세요.\n\n${prompt}`;

          const gatewayOptions: AIGatewayOptions = {
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            systemPrompt: module.buildSystemPrompt(),
            maxOutputTokens: 8192,
            timeoutMs: cfg.mapTimeoutMs,
          };

          const mapResult = await callWithRetry(
            () => analyzeStructured(mapPrompt, module.schema, gatewayOptions),
            chunkLabel,
          );

          console.log(`[map-reduce] ${chunkLabel}: 완료`);
          return { result: mapResult.object, chunkIndex: chunkIdx, usage: mapResult.usage };
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          const { result, chunkIndex, usage } = settled.value;
          totalUsage.inputTokens += (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0;
          totalUsage.outputTokens += (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0;
          totalUsage.totalTokens += (usage as any)?.totalTokens ?? 0;
          mapResults.push({ result, chunkIndex });
        } else {
          const errMsg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          console.error(`[map-reduce] ${module.name}[chunk]: 실패 — ${errMsg}`);
        }
      }
    }

    // 성공한 Map 결과가 없으면 실패
    if (mapResults.length === 0) {
      throw new Error(`모든 청크 분석 실패 (${chunks.length}개)`);
    }

    // Map 결과가 1개면 Reduce 없이 바로 반환
    if (mapResults.length === 1) {
      console.log(`[map-reduce] ${module.name}: Map 1개만 성공, Reduce 생략`);
      const moduleResult: AnalysisModuleResult<T> = {
        module: module.name,
        status: 'completed',
        result: mapResults[0].result,
        usage: { ...totalUsage, provider: config.provider, model: config.model },
      };
      await persistAnalysisResult({
        jobId: input.jobId,
        module: module.name,
        status: 'completed',
        result: moduleResult.result,
        usage: moduleResult.usage,
      });
      return moduleResult;
    }

    // === REDUCE 단계 ===
    console.log(`[map-reduce] ${module.name}: Reduce 시작 (${mapResults.length}개 결과 종합)`);

    const reducePrompt = buildReducePrompt(
      module,
      input.keyword,
      mapResults.map((r) => r.result),
      chunks.length,
    );

    const reduceOptions: AIGatewayOptions = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      systemPrompt: module.buildSystemPrompt(),
      maxOutputTokens: 8192,
      timeoutMs: cfg.reduceTimeoutMs,
    };

    const reduceResult = await callWithRetry(
      () => analyzeStructured(reducePrompt, module.schema, reduceOptions),
      `${module.name}[reduce]`,
    );

    totalUsage.inputTokens += (reduceResult.usage as any)?.promptTokens ?? (reduceResult.usage as any)?.inputTokens ?? 0;
    totalUsage.outputTokens += (reduceResult.usage as any)?.completionTokens ?? (reduceResult.usage as any)?.outputTokens ?? 0;
    totalUsage.totalTokens += (reduceResult.usage as any)?.totalTokens ?? 0;

    const moduleResult: AnalysisModuleResult<T> = {
      module: module.name,
      status: 'completed',
      result: reduceResult.object,
      usage: { ...totalUsage, provider: config.provider, model: config.model },
    };

    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'completed',
      result: moduleResult.result,
      usage: moduleResult.usage,
    });

    console.log(`[map-reduce] ${module.name}: 완료 (Map ${mapResults.length}/${chunks.length} + Reduce, 토큰=${totalUsage.totalTokens})`);
    return moduleResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'failed',
      errorMessage,
    });

    return { module: module.name, status: 'failed', errorMessage };
  }
}
