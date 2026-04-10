// Map-Reduce 분석 파이프라인
// 대량 데이터(59K+ 토큰)를 청크로 분할하여 개별 분석(Map) 후 종합(Reduce)
// Context Rot 방지 + Rate Limit 완화 + 정확도 향상
import {
  analyzeStructured,
  normalizeUsage,
  type AIGatewayOptions,
} from '@krdn/ai-analysis-kit/gateway';
import { appendJobEvent } from '../pipeline/persist';
import { isPipelineCancelled } from '../pipeline/control';
import { persistAnalysisResult } from './persist-analysis';
import { getModuleModelConfig } from './model-config';
import { runModule } from './runner';
import {
  isRateLimitError,
  isServerOverloadError,
  parseRetryAfter,
  sleep,
  MAX_RATE_LIMIT_RETRIES,
} from './retry-utils';
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
  mapTimeoutMs: 300_000,
  reduceTimeoutMs: 300_000,
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

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      error.name === 'AbortError' ||
      error.name === 'TimeoutError'
    );
  }
  return false;
}

const MAX_TIMEOUT_RETRIES = 1;

async function callWithRetry<T>(fn: () => Promise<T>, label: string, jobId?: number): Promise<T> {
  let lastError: unknown;
  let rateLimitAttempts = 0;
  let timeoutAttempts = 0;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES + MAX_TIMEOUT_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Rate limit 재시도 (토큰 비용 미발생)
      if (isRateLimitError(error) && rateLimitAttempts < MAX_RATE_LIMIT_RETRIES) {
        rateLimitAttempts++;
        const retryAfterSec = parseRetryAfter(error);
        const backoffMs = Math.max(retryAfterSec * 1000, rateLimitAttempts * 3000);
        const msg = `${label}: Rate limit 도달, ${Math.round(backoffMs / 1000)}초 후 재시도 (${rateLimitAttempts}/${MAX_RATE_LIMIT_RETRIES})`;
        console.log(`[map-reduce] ${msg}`);
        if (jobId) appendJobEvent(jobId, 'warn', msg).catch(() => {});
        await sleep(backoffMs);
        continue;
      }
      // 서버 과부하 재시도 (타임아웃과 동일 정책)
      if (isServerOverloadError(error) && timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        const msg = `${label}: 서버 과부하, 15초 후 재시도 (${timeoutAttempts}/${MAX_TIMEOUT_RETRIES})`;
        console.log(`[map-reduce] ${msg}`);
        if (jobId) appendJobEvent(jobId, 'warn', msg).catch(() => {});
        await sleep(15_000);
        continue;
      }
      // 타임아웃 재시도 (1회만 — 일시적 서버 지연일 수 있음)
      if (isTimeoutError(error) && timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        const msg = `${label}: 타임아웃 발생, 10초 후 재시도 (${timeoutAttempts}/${MAX_TIMEOUT_RETRIES})`;
        console.log(`[map-reduce] ${msg}`);
        if (jobId) appendJobEvent(jobId, 'warn', msg).catch(() => {});
        await sleep(10_000);
        continue;
      }
      // 기타 에러 — 즉시 전파
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

// --- Map-Reduce 실행 ---

/**
 * Map-Reduce로 분석 모듈 실행
 * 데이터가 작으면 기존 runModule()로 위임 (단일 패스)
 */
export async function runModuleMapReduce<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
  configAdapter?: Parameters<typeof runModule>[3],
): Promise<AnalysisModuleResult<T>> {
  const cfg = DEFAULT_CONFIG;
  const chunks = chunkAnalysisInput(input);

  // 청크 1개 = 소규모 데이터 → 기존 단일 패스
  if (chunks.length === 1) {
    return runModule(module, input, priorResults, configAdapter);
  }

  console.log(
    `[map-reduce] ${module.name}: ${chunks.length}개 청크로 Map-Reduce 실행 (총 기사=${input.articles.length}, 댓글=${input.comments.length})`,
  );

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
    const chunkErrors: string[] = [];

    const cc = await getConcurrencyConfig();
    const mapConcurrency = cc.providerConcurrency[config.provider] ?? 2;
    console.log(`[map-reduce] ${module.name}: Map 동시성=${mapConcurrency} (${config.provider})`);

    for (let i = 0; i < chunks.length; i += mapConcurrency) {
      // 각 배치 시작 전 취소 확인
      if (await isPipelineCancelled(input.jobId)) {
        console.log(`[map-reduce] ${module.name}: 취소 감지 — Map 단계 중단`);
        throw new Error('사용자에 의해 중지됨');
      }

      const batch = chunks.slice(i, i + mapConcurrency);

      // 배치 전체에 대한 AbortController — 취소 시 진행 중인 API 호출도 즉시 중단
      const batchAbort = new AbortController();
      const cancelPoller = setInterval(async () => {
        try {
          if (await isPipelineCancelled(input.jobId)) {
            batchAbort.abort(new Error('사용자에 의해 중지됨'));
          }
        } catch {
          /* DB 조회 실패 무시 */
        }
      }, 3000);

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
            abortSignal: batchAbort.signal,
          };

          const mapResult = await callWithRetry(
            () => analyzeStructured(mapPrompt, module.schema, gatewayOptions),
            chunkLabel,
            input.jobId,
          );

          console.log(`[map-reduce] ${chunkLabel}: 완료`);
          return { result: mapResult.object, chunkIndex: chunkIdx, usage: mapResult.usage };
        }),
      );

      clearInterval(cancelPoller);

      // 배치 abort된 경우 즉시 중단
      if (batchAbort.signal.aborted) {
        throw new Error('사용자에 의해 중지됨');
      }

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
          const errStack = settled.reason instanceof Error ? settled.reason.stack : undefined;
          console.error(`[map-reduce] ${module.name}[chunk]: 실패 — ${errMsg}`);
          if (errStack) {
            console.error(`[map-reduce] ${module.name}[chunk]: 스택:\n${errStack}`);
          }
          // cause 체인 추적
          if (settled.reason instanceof Error && settled.reason.cause) {
            const causeMsg =
              settled.reason.cause instanceof Error
                ? settled.reason.cause.message
                : String(settled.reason.cause);
            console.error(`[map-reduce] ${module.name}[chunk]: 원인(cause): ${causeMsg}`);
          }
          chunkErrors.push(errMsg);
          appendJobEvent(
            input.jobId,
            'warn',
            `${module.name} 청크 분석 실패 (계속 진행): ${errMsg}`,
          ).catch(() => {});
        }
      }
    }

    // 성공한 Map 결과가 없으면 실패 — 청크별 에러 메시지 포함
    if (mapResults.length === 0) {
      const detail = chunkErrors.length > 0 ? ` | 청크 에러: ${chunkErrors.join(' / ')}` : '';
      throw new Error(`모든 청크 분석 실패 (${chunks.length}개)${detail}`);
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
    // Reduce 시작 전 취소 확인
    if (await isPipelineCancelled(input.jobId)) {
      console.log(`[map-reduce] ${module.name}: 취소 감지 — Reduce 단계 중단`);
      throw new Error('사용자에 의해 중지됨');
    }
    console.log(`[map-reduce] ${module.name}: Reduce 시작 (${mapResults.length}개 결과 종합)`);

    const reducePrompt = buildReducePrompt(
      module,
      input.keyword,
      mapResults.map((r) => r.result),
      chunks.length,
    );

    // Reduce용 AbortController — 취소 시 진행 중인 API 호출도 즉시 중단
    const reduceAbort = new AbortController();
    const reduceCancelPoller = setInterval(async () => {
      try {
        if (await isPipelineCancelled(input.jobId)) {
          reduceAbort.abort(new Error('사용자에 의해 중지됨'));
        }
      } catch {
        /* DB 조회 실패 무시 */
      }
    }, 3000);

    const reduceOptions: AIGatewayOptions = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      systemPrompt: module.buildSystemPrompt(),
      maxOutputTokens: 8192,
      timeoutMs: cfg.reduceTimeoutMs,
      abortSignal: reduceAbort.signal,
    };

    let reduceResult;
    try {
      reduceResult = await callWithRetry(
        () => analyzeStructured(reducePrompt, module.schema, reduceOptions),
        `${module.name}[reduce]`,
        input.jobId,
      );
    } finally {
      clearInterval(reduceCancelPoller);
    }

    const reduceNorm = normalizeUsage(reduceResult.usage as Record<string, unknown>);
    totalUsage.inputTokens += reduceNorm.inputTokens;
    totalUsage.outputTokens += reduceNorm.outputTokens;
    totalUsage.totalTokens += reduceNorm.totalTokens;

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

    console.log(
      `[map-reduce] ${module.name}: 완료 (Map ${mapResults.length}/${chunks.length} + Reduce, 토큰=${totalUsage.totalTokens})`,
    );
    return moduleResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // 정밀 디버깅 로그
    console.error(`[map-reduce] ${module.name}: Map-Reduce 분석 실패 (jobId=${input.jobId})`);
    console.error(`[map-reduce] ${module.name}: 에러 메시지: ${errorMessage}`);
    if (errorStack) {
      console.error(`[map-reduce] ${module.name}: 스택 트레이스:\n${errorStack}`);
    }
    if (error instanceof Error && error.cause) {
      const causeMsg = error.cause instanceof Error ? error.cause.message : String(error.cause);
      console.error(`[map-reduce] ${module.name}: 원인(cause): ${causeMsg}`);
    }

    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'failed',
      errorMessage,
    });

    appendJobEvent(
      input.jobId,
      'error',
      `${module.name} Map-Reduce 분석 실패: ${errorMessage}`,
    ).catch(() => {});
    return { module: module.name, status: 'failed', errorMessage };
  }
}
