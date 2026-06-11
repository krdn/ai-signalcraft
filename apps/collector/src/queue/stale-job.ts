/**
 * 큐에 묵었다 늦게 실행된 "백로그(catch-up)" 잡 판정.
 *
 * 잡의 dateRange.endISO는 스케줄러/수동 트리거의 enqueue 시각(now)과 같다.
 * 윈도우 끝이 한 interval 이상 과거라면 이 잡은 생성 후 큐에서 interval 이상
 * 대기한 백로그다. 이런 잡의 완료가 subscription.nextRunAt을 now+interval로
 * 밀면, 백로그가 소진될 때까지 스케줄러가 due를 보지 못해 신규(현재 윈도우)
 * 잡 발급이 기아 상태에 빠진다 (2026-06-11 dcinside 운영 분석).
 */
export function isStaleCatchupJob(
  windowEndISO: string,
  intervalHours: number,
  nowMs: number = Date.now(),
): boolean {
  const endMs = Date.parse(windowEndISO);
  if (!Number.isFinite(endMs)) return false;
  return nowMs - endMs > intervalHours * 3600 * 1000;
}
