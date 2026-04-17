/**
 * 경량 trace 시스템
 *
 * OpenTelemetry full SDK는 무겁고 외부 collector 필요.
 * 단기 대안: async context 기반 span 계층 + Redis에 최근 N개 trace 저장.
 *
 * Trace 구조:
 *   trace (jobId 단위)
 *   ├─ span "normalization"
 *   ├─ span "token-optimization"
 *   │  ├─ span "deduplicate"
 *   │  └─ span "compress-comments"
 *   └─ span "stage1" (parallel)
 *      ├─ span "module:macro-view"
 *      └─ span "module:segmentation"
 *
 * 용도: 특정 job의 병목 구간 디버깅, 계층별 소요 시간 시각화
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { getCacheRedis, getCachePrefix } from '../cache/redis-cache';

const TRACE_TTL_SEC = 7 * 24 * 60 * 60; // 7일

export interface Span {
  id: string;
  parentId: string | null;
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, string | number | boolean>;
  status?: 'ok' | 'error';
  errorMessage?: string;
}

interface TraceContext {
  traceId: string;
  currentSpan: Span | null;
  spans: Span[];
}

const storage = new AsyncLocalStorage<TraceContext>();

function traceKey(traceId: string): string {
  return [getCachePrefix(), 'trace', traceId].filter(Boolean).join(':');
}

/**
 * 새 trace 시작 — 최상위 span 생성
 */
export async function startTrace<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Span['attributes'],
): Promise<T> {
  const traceId = randomUUID();
  const rootSpan: Span = {
    id: randomUUID(),
    parentId: null,
    name,
    startTime: Date.now(),
    attributes,
  };
  const ctx: TraceContext = {
    traceId,
    currentSpan: rootSpan,
    spans: [rootSpan],
  };

  return storage.run(ctx, async () => {
    try {
      const result = await fn();
      rootSpan.endTime = Date.now();
      rootSpan.status = 'ok';
      await persistTrace(ctx);
      return result;
    } catch (error) {
      rootSpan.endTime = Date.now();
      rootSpan.status = 'error';
      rootSpan.errorMessage = error instanceof Error ? error.message : String(error);
      await persistTrace(ctx);
      throw error;
    }
  });
}

/**
 * 자식 span 생성
 * trace 컨텍스트가 없으면 fn만 실행 (tracing 비활성화)
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Span['attributes'],
): Promise<T> {
  const ctx = storage.getStore();
  if (!ctx) return fn();

  const parent = ctx.currentSpan;
  const span: Span = {
    id: randomUUID(),
    parentId: parent?.id ?? null,
    name,
    startTime: Date.now(),
    attributes,
  };
  ctx.spans.push(span);

  return storage.run({ ...ctx, currentSpan: span }, async () => {
    try {
      const result = await fn();
      span.endTime = Date.now();
      span.status = 'ok';
      return result;
    } catch (error) {
      span.endTime = Date.now();
      span.status = 'error';
      span.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  });
}

/** 현재 span에 attribute 추가 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const ctx = storage.getStore();
  if (!ctx?.currentSpan) return;
  ctx.currentSpan.attributes = { ...ctx.currentSpan.attributes, [key]: value };
}

/** 현재 trace id 조회 */
export function getCurrentTraceId(): string | null {
  return storage.getStore()?.traceId ?? null;
}

async function persistTrace(ctx: TraceContext): Promise<void> {
  try {
    const redis = getCacheRedis();
    const key = traceKey(ctx.traceId);
    await (redis as any).set(key, JSON.stringify(ctx.spans), 'EX', TRACE_TTL_SEC);
  } catch {
    // tracing 실패는 파이프라인을 막지 않음
  }
}

/**
 * trace 조회 (디버깅 UI/CLI용)
 */
export async function getTrace(traceId: string): Promise<Span[] | null> {
  try {
    const redis = getCacheRedis();
    const raw = await (redis as any).get(traceKey(traceId));
    if (!raw) return null;
    return JSON.parse(raw) as Span[];
  } catch {
    return null;
  }
}

/**
 * trace를 사람이 읽기 쉬운 트리 형태로 포매팅
 */
export function formatTraceTree(spans: Span[]): string {
  const byParent = new Map<string | null, Span[]>();
  for (const s of spans) {
    const p = s.parentId;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(s);
  }

  const lines: string[] = [];
  const render = (span: Span, depth: number): void => {
    const indent = '  '.repeat(depth);
    const dur = span.endTime ? `${span.endTime - span.startTime}ms` : 'in-progress';
    const status = span.status === 'error' ? ' ✗' : '';
    lines.push(`${indent}${span.name} (${dur})${status}`);
    if (span.errorMessage) {
      lines.push(`${indent}  ! ${span.errorMessage}`);
    }
    const children = byParent.get(span.id) ?? [];
    for (const child of children) render(child, depth + 1);
  };

  const roots = byParent.get(null) ?? [];
  for (const root of roots) render(root, 0);
  return lines.join('\n');
}
