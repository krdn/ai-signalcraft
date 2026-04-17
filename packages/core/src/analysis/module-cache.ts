/**
 * 분석 모듈 결과 캐싱 (프롬프트 캐싱 대체 전략)
 *
 * Claude/Gemini의 프로바이더 레벨 프롬프트 캐싱은 kit 확장이 필요하다.
 * 단기 대안: 같은 (module, input-hash, domain) 조합은 Redis에 결과를 캐시하여
 * 반복 분석 시 LLM 호출 자체를 건너뛴다.
 *
 * 캐시 키: analysis:<module>:<domain>:<input-hash>
 * TTL: 24시간 (기본)
 *
 * input-hash는 articles/comments의 정규화된 텍스트 내용만 해시 (순서 무관).
 * jobId / keyword / dateRange는 해시에서 제외 — 같은 데이터면 같은 분석.
 */
import { createHash } from 'node:crypto';
import { cacheGet, cacheSet } from '../cache/redis-cache';
import type { AnalysisInput, AnalysisModuleResult } from './types';

const DEFAULT_TTL_SEC = 24 * 60 * 60;

/** input 데이터의 결정적 해시 생성 (순서 무관) */
export function hashAnalysisInput(input: AnalysisInput, extraContext?: string): string {
  const articlesFp = input.articles
    .map((a) => `${a.title}|${(a.content ?? '').slice(0, 200)}`)
    .sort()
    .join('\n');
  const commentsFp = input.comments
    .map((c) => c.content.slice(0, 100))
    .sort()
    .join('\n');
  const videosFp = input.videos
    .map((v) => `${v.title}|${(v.description ?? '').slice(0, 200)}`)
    .sort()
    .join('\n');

  const payload = [
    extraContext ?? '',
    input.domain ?? 'default',
    input.keyword,
    `ART:${articlesFp}`,
    `CMT:${commentsFp}`,
    `VID:${videosFp}`,
  ].join('\n---\n');

  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

function moduleCacheKey(moduleName: string, inputHash: string): string {
  return `analysis:${moduleName}:${inputHash}`;
}

/** 캐시된 모듈 결과 조회 */
export async function getCachedModuleResult<T = unknown>(
  moduleName: string,
  inputHash: string,
): Promise<AnalysisModuleResult<T> | null> {
  try {
    return await cacheGet<AnalysisModuleResult<T>>(moduleCacheKey(moduleName, inputHash));
  } catch {
    return null;
  }
}

/** 모듈 결과 캐시 저장 */
export async function setCachedModuleResult<T = unknown>(
  moduleName: string,
  inputHash: string,
  result: AnalysisModuleResult<T>,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<void> {
  try {
    // 실패/스킵된 결과는 캐시하지 않음
    if (result.status !== 'completed') return;
    await cacheSet(moduleCacheKey(moduleName, inputHash), result, ttlSec);
  } catch {
    // ignore
  }
}
