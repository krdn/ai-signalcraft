/**
 * Map-Reduce 분석 파이프라인 (DB 의존 없음)
 * 대량 데이터를 청크로 분할 → 병렬 Map → Reduce 종합
 */
import {
  analyzeStructured,
  normalizeUsage,
  type AIGatewayOptions,
} from '@ai-signalcraft/insight-gateway';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult } from './types';
import { runModule, type RunModuleParams } from './runner';
import {
  isRateLimitError,
  isServerOverloadError,
  isTimeoutError,
  parseRetryAfter,
  sleep,
  MAX_RATE_LIMIT_RETRIES,
} from './retry-utils';

interface MapReduceConfig {
  chunkTargetChars: number;
  minCharsForChunking: number;
  mapTimeoutMs: number;
  reduceTimeoutMs: number;
  mapConcurrency: number;
}

const DEFAULT_CONFIG: MapReduceConfig = {
  chunkTargetChars: 15_000,
  minCharsForChunking: 20_000,
  mapTimeoutMs: 300_000,
  reduceTimeoutMs: 300_000,
  mapConcurrency: 2,
};

const MAX_TIMEOUT_RETRIES = 1;

function estimateChars(input: AnalysisInput): number {
  let total = 0;
  for (const a of input.articles) {
    total += (a.title?.length ?? 0) + (a.content?.length ?? 0) + 50;
  }
  for (const v of input.videos) {
    total += (v.title?.length ?? 0) + 80;
  }
  for (const c of input.comments) {
    total += (c.content?.length ?? 0) + 30;
  }
  return total;
}

/** 분석 입력 데이터를 균등한 청크로 분할 */
export function chunkAnalysisInput(
  input: AnalysisInput,
  config: Partial<MapReduceConfig> = {},
): AnalysisInput[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const totalChars = estimateChars(input);

  if (totalChars < cfg.minCharsForChunking) return [input];

  const numChunks = Math.max(2, Math.ceil(totalChars / cfg.chunkTargetChars));

  const articleChunks: (typeof input.articles)[] = Array.from({ length: numChunks }, () => []);
  for (let i = 0; i < input.articles.length; i++) {
    articleChunks[i % numChunks].push(input.articles[i]);
  }

  const commentChunks: (typeof input.comments)[] = Array.from({ length: numChunks }, () => []);
  for (let i = 0; i < input.comments.length; i++) {
    commentChunks[i % numChunks].push(input.comments[i]);
  }

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

type CallWithRetryCtx = {
  label: string;
  onEvent?: (level: 'info' | 'warn' | 'error', message: string) => void;
};

async function callWithRetry<T>(fn: () => Promise<T>, ctx: CallWithRetryCtx): Promise<T> {
  let lastError: unknown;
  let rateLimitAttempts = 0;
  let timeoutAttempts = 0;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES + MAX_TIMEOUT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error) && rateLimitAttempts < MAX_RATE_LIMIT_RETRIES) {
        rateLimitAttempts++;
        const retryAfterSec = parseRetryAfter(error);
        const backoffMs = Math.max(retryAfterSec * 1000, rateLimitAttempts * 3000);
        ctx.onEvent?.(
          'warn',
          `${ctx.label}: Rate limit, ${Math.round(backoffMs / 1000)}초 후 재시도 (${rateLimitAttempts}/${MAX_RATE_LIMIT_RETRIES})`,
        );
        await sleep(backoffMs);
        continue;
      }

      if (isServerOverloadError(error) && timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        ctx.onEvent?.('warn', `${ctx.label}: 서버 과부하, 15초 후 재시도`);
        await sleep(15_000);
        continue;
      }

      if (isTimeoutError(error) && timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        ctx.onEvent?.('warn', `${ctx.label}: 타임아웃, 10초 후 재시도`);
        await sleep(10_000);
        continue;
      }

      throw error;
    }
  }
  throw lastError;
}

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

## 종합 절차 (반드시 이 순서로 수행)

### Step 1: 배열 항목 병합
- 동일한 의미의 항목은 중복 제거 후 병합하세요
- 서로 다른 관점의 항목은 모두 유지하세요
- 병합 시 더 구체적인 설명을 가진 항목을 우선하세요

### Step 2: 수치 통합
- 감정 비율(sentimentRatio 등)은 청크별 데이터 건수를 가중치로 한 가중 평균으로 계산하세요
- 점수(impactScore, strength 등)는 동일 항목이 여러 청크에 등장하면 평균을 사용하세요
- 빈도(count)는 합산하세요

### Step 3: 서사 재구성
- 각 청크의 요약(summary)은 단순 연결이 아닌, 전체 데이터 관점에서 인과적 서사로 재작성하세요
- 방향성(overallDirection 등)은 통합 수치를 기반으로 재판단하세요

### Step 4: 품질 검증
- 최종 결과에 빈 배열이나 누락된 필드가 없는지 확인하세요
- 모든 청크의 인사이트가 빠짐없이 반영되었는지 확인하세요

## 청크별 분석 결과
${resultsJson}

위 ${totalChunks}개 청크 결과를 하나의 통합 분석으로 종합하세요.
반드시 한국어로 응답하세요.`;
}

export interface RunModuleMapReduceParams<T> extends RunModuleParams<T> {
  mapReduceConfig?: Partial<MapReduceConfig>;
}

/**
 * Map-Reduce로 분석 모듈 실행
 * 데이터가 작으면 runModule로 위임 (단일 패스)
 */
export async function runModuleMapReduce<T>(
  params: RunModuleMapReduceParams<T>,
): Promise<AnalysisModuleResult<T>> {
  const { module, input, config, signal, onUsage, onEvent, mapReduceConfig } = params;
  const cfg = { ...DEFAULT_CONFIG, ...mapReduceConfig };
  const chunks = chunkAnalysisInput(input, cfg);

  if (chunks.length === 1) {
    return runModule(params);
  }

  onEvent?.(
    'info',
    `${module.name}: ${chunks.length}개 청크로 Map-Reduce 실행 (기사=${input.articles.length}, 댓글=${input.comments.length})`,
  );

  try {
    const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const mapResults: { result: unknown; chunkIndex: number }[] = [];
    const chunkErrors: string[] = [];

    // === MAP 단계 ===
    for (let i = 0; i < chunks.length; i += cfg.mapConcurrency) {
      if (signal?.aborted) throw new Error('외부 취소 신호 수신');

      const batch = chunks.slice(i, i + cfg.mapConcurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (chunk, batchIdx) => {
          const chunkIdx = i + batchIdx;
          const label = `${module.name}[chunk ${chunkIdx + 1}/${chunks.length}]`;
          const basePrompt = module.buildPrompt(chunk);
          const mapPrompt = `[데이터 청크 ${chunkIdx + 1}/${chunks.length}] 전체 수집 데이터 중 일부입니다. 이 부분의 데이터만 분석하세요.\n\n${basePrompt}`;

          const gatewayOptions: AIGatewayOptions = {
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            systemPrompt: module.buildSystemPrompt(),
            maxOutputTokens: config.maxOutputTokens ?? 8192,
            timeoutMs: cfg.mapTimeoutMs,
            abortSignal: signal,
          };

          const mapResult = await callWithRetry(
            () => analyzeStructured(mapPrompt, module.schema, gatewayOptions),
            { label, onEvent },
          );
          onEvent?.('info', `${label}: 완료`);
          return { result: mapResult.object, chunkIndex: chunkIdx, usage: mapResult.usage };
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === 'fulfilled') {
          const { result, chunkIndex, usage } = settled.value;
          const norm = normalizeUsage(usage as Record<string, unknown>);
          totalUsage.inputTokens += norm.inputTokens;
          totalUsage.outputTokens += norm.outputTokens;
          totalUsage.totalTokens += norm.totalTokens;
          mapResults.push({ result, chunkIndex });
        } else {
          const errMsg =
            settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          chunkErrors.push(errMsg);
          onEvent?.('warn', `${module.name} 청크 분석 실패 (계속 진행): ${errMsg}`);
        }
      }
    }

    if (mapResults.length === 0) {
      const detail = chunkErrors.length > 0 ? ` | 청크 에러: ${chunkErrors.join(' / ')}` : '';
      throw new Error(`모든 청크 분석 실패 (${chunks.length}개)${detail}`);
    }

    if (mapResults.length === 1) {
      onEvent?.('info', `${module.name}: Map 1개만 성공, Reduce 생략`);
      const usage = { ...totalUsage, provider: config.provider, model: config.model };
      onUsage?.(usage);
      return {
        module: module.name,
        status: 'completed',
        result: mapResults[0].result as T,
        usage,
      };
    }

    // === REDUCE 단계 ===
    if (signal?.aborted) throw new Error('외부 취소 신호 수신');
    onEvent?.('info', `${module.name}: Reduce 시작 (${mapResults.length}개 결과 종합)`);

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
      maxOutputTokens: config.maxOutputTokens ?? 8192,
      timeoutMs: cfg.reduceTimeoutMs,
      abortSignal: signal,
    };

    const reduceResult = await callWithRetry(
      () => analyzeStructured(reducePrompt, module.schema, reduceOptions),
      { label: `${module.name}[reduce]`, onEvent },
    );

    const reduceNorm = normalizeUsage(reduceResult.usage as Record<string, unknown>);
    totalUsage.inputTokens += reduceNorm.inputTokens;
    totalUsage.outputTokens += reduceNorm.outputTokens;
    totalUsage.totalTokens += reduceNorm.totalTokens;

    const usage = { ...totalUsage, provider: config.provider, model: config.model };
    onUsage?.(usage);

    onEvent?.(
      'info',
      `${module.name}: 완료 (Map ${mapResults.length}/${chunks.length} + Reduce, 토큰=${totalUsage.totalTokens})`,
    );
    return {
      module: module.name,
      status: 'completed',
      result: reduceResult.object as T,
      usage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onEvent?.('error', `${module.name}: Map-Reduce 분석 실패 — ${errorMessage}`);
    return {
      module: module.name,
      status: 'failed',
      errorMessage,
    };
  }
}
