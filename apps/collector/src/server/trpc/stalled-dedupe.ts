/**
 * stalled run 목록의 (runId, source) 중복 제거.
 *
 * 워커 강제 종료(배포 재시작 등) 후 startup-recovery가 같은 run을 재실행하면
 * collection_runs에 동일 (runId, source)의 running 행이 중복으로 남을 수 있다.
 * 모니터 UI는 (runId, source)를 React key로 쓰므로 최신 행 하나만 노출한다.
 *
 * 입력은 time DESC 정렬을 전제로 하며, 같은 키의 첫 번째(=최신) 행을 유지한다.
 */
export function dedupeLatestRunRows<T extends { runId: string; source: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.runId} ${r.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
