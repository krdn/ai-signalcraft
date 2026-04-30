// collected-data 라우터 공통 타입/헬퍼
//
// 본 라우터의 procedure들은 두 가지 조회 경로를 분기한다:
//   1) 일반 잡: web DB의 article_jobs / video_jobs / comment_jobs 조인 테이블 조회
//   2) 구독 잡 (useCollectorLoader 또는 subscriptionId 있음): collector tRPC API 위임
// 분기 판정과 옵션 추출 로직을 한 곳에 모은다.

export type JobWithOptions = {
  id: number;
  keyword: string;
  startDate: Date;
  endDate: Date;
  status: string;
  limits: unknown;
  options: unknown;
  appliedPreset: unknown;
  createdAt: Date;
  progress: unknown;
};

export function isCollectorJob(job: JobWithOptions): boolean {
  const opts = (job.options as Record<string, unknown>) || {};
  return !!opts.useCollectorLoader || !!opts.subscriptionId;
}

export function getSubscriptionId(job: JobWithOptions): number | undefined {
  const opts = (job.options as Record<string, unknown>) || {};
  return opts.subscriptionId as number | undefined;
}
