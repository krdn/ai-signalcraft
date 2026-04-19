/**
 * 지원 소스 — subscriptions 라우터의 SOURCE_ENUM과 1:1 대응.
 * 새 소스 추가 시 양쪽 함께 수정 (향후 단일 상수로 통합 예정).
 *
 * 'naver-comments'는 내부 전용 source — 사용자는 직접 선택하지 않고,
 * naver-news 수집 이후 executor가 기사 URL을 fan-out해서 자동 enqueue한다.
 */
export const COLLECTOR_SOURCES = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;
export type CollectorSource = (typeof COLLECTOR_SOURCES)[number];

/**
 * 댓글 fan-out child job payload 항목.
 */
export interface CommentTarget {
  url: string;
  articleSourceId: string;
}

/**
 * 수집 큐 job payload — scheduler 또는 triggerNow가 생성.
 */
export interface CollectionJobData {
  runId: string;
  subscriptionId: number;
  source: CollectorSource;
  keyword: string;
  limits: {
    maxPerRun: number;
    commentsPerItem?: number;
  };
  options?: {
    collectTranscript?: boolean;
    includeComments?: boolean;
  };
  /** 수집 시간 범위 — 스케줄러는 "직전 수집 이후 ~ 지금" 범위를 넘김 */
  dateRange: {
    startISO: string;
    endISO: string;
  };
  triggerType: 'schedule' | 'manual';
  /**
   * source='naver-comments' 전용 — naver-news 실행 후 fan-out된 기사 URL 목록.
   * executor가 각 URL에 대해 NaverCommentsCollector.collectForArticle을 직렬 호출.
   */
  commentTargets?: CommentTarget[];
}

export interface CollectionJobResult {
  runId: string;
  itemsCollected: number;
  itemsNew: number;
  blocked: boolean;
  durationMs: number;
}
