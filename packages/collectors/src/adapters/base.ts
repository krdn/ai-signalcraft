import { z } from 'zod';

export const CollectionOptionsSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxItems: z.number().optional(),
  maxComments: z.number().optional(),
  /**
   * 수집 모드. dayWindow 경로 결정 외에 어댑터 동작을 바꾸지 않음.
   * 'incremental': 매일/매시간 자동 수집 (좁은 윈도우, 낮은 cap)
   * 'backfill':    수동 트리거의 과거 백필 (큰 윈도우, 높은 cap)
   * 미지정: 기존 경로(legacy/range) 유지 — backward compatible
   */
  mode: z.enum(['incremental', 'backfill']).optional(),
  // perDay 모드에서 사용자가 지정한 "1일당 한도".
  // flows.ts가 perDay 모드 + dayCount > 1일 때만 명시 전달.
  // 어댑터는 이 값을 일자별 cap의 절대 상한으로 사용 — 한도 초과 금지, 부족분 보충 금지.
  // 미지정(total 모드 등) 시 어댑터는 일자별 cap을 비활성화하고 기존 maxItems만 사용.
  maxItemsPerDay: z.number().int().positive().optional(),
  // TTL 기반 재사용 계획 (flows.ts 가 planReuse 결과로 주입)
  // adapter 는 skipUrls 를 검색 결과에서 제외, refetchCommentsFor 에 포함된 URL 은
  // 본문 fetch 를 건너뛰고 댓글만 수집한다.
  reusePlan: z
    .object({
      skipUrls: z.array(z.string()).default([]),
      refetchCommentsFor: z.array(z.string()).default([]),
    })
    .optional(),
  // 증분 댓글 수집 컷오프. 이 시각 이후(publishedAt > since)의 댓글만 수집.
  // 네이버/유튜브 댓글 어댑터만 해석한다 (커뮤니티 어댑터는 무시).
  since: z.string().datetime().optional(),
  commentOrder: z.enum(['relevance', 'time']).default('relevance').optional(),
  collectTranscript: z.boolean().default(true).optional(),
});
export type CollectionOptions = z.infer<typeof CollectionOptionsSchema>;

export interface CollectionResult<T> {
  source: string;
  items: T[];
  totalCollected: number;
  errors: Error[];
  metadata: {
    startedAt: Date;
    completedAt: Date;
    pagesFetched: number;
  };
}

/**
 * 어댑터가 collect 종료 시 보고하는 통계 (디버깅·운영 가시성용).
 * collector-worker가 collect 종료 후 getLastRunStats()로 읽어 DB events에 기록한다.
 */
export interface CollectionStats {
  /** 종료 사유 — 운영 진단의 핵심 */
  endReason:
    | 'maxItemsReached'
    | 'consecutiveOldThreshold'
    | 'pageLimitReached'
    | 'maxPagesReached'
    | 'pageEmptyOrBlocked'
    | 'noMoreResults'
    | 'completed'
    | 'quotaExhausted';
  /** 마지막으로 시도한 검색 페이지 번호 */
  lastPage: number;
  /** 일자별 수집 분포 (KST yyyy-mm-dd → count) */
  perDayCount: Record<string, number>;
  /** 사전 cap으로 본문 fetch 생략한 글 수 */
  perDayCapSkip?: number;
  /** 검색 결과 사전 필터로 제외된 수 */
  preFilterSkip?: number;
  /** 본문 publishedAt이 기간 외라 제외된 수 */
  outOfRange?: number;
  /** 차단/빈 페이지 발생 수 */
  pageEmptyCount?: number;
  /** API 쿼터 사용량 (YouTube 등) */
  quotaUsed?: number;
  /** API 쿼터 잔여량 */
  quotaRemaining?: number;
  /** 폴백 전략 사용 여부 */
  usedFallback?: boolean;
}

// 모든 수집기가 구현하는 인터페이스
export interface Collector<T = unknown> {
  readonly source: string;
  collect(options: CollectionOptions): AsyncGenerator<T[], void, unknown>;
  // AsyncGenerator로 청크 단위 yield -- 메모리 효율 + 진행률 추적

  /**
   * 가장 최근 collect() 종료 직후의 통계를 반환 (선택).
   * 구현 안 한 어댑터는 미정의(undefined). collector-worker가 종료 후 호출해 events에 기록.
   */
  getLastRunStats?(): CollectionStats | null;
}
