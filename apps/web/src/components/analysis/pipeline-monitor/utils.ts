// 파이프라인 모니터 유틸리티 함수

/** 초를 "X분 Y초" 형식으로 포맷 */
export function formatElapsed(seconds: number): string {
  if (seconds < 0) return '0초';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}초`;
  return `${min}분 ${sec}초`;
}

/** 토큰 수를 읽기 쉬운 형태로 포맷 (예: 1234 → "1.2K") */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${Math.round(tokens / 1000)}K`;
}

/** USD 비용을 포맷 (예: 0.0234 → "$0.023") */
export function formatCostUsd(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/** 건/분 속도 계산 */
export function calcRate(count: number, elapsedSeconds: number): string {
  if (elapsedSeconds <= 0 || count <= 0) return '-';
  const perMin = (count / elapsedSeconds) * 60;
  if (perMin < 1) return `${(perMin * 60).toFixed(1)}건/시`;
  return `${perMin.toFixed(1)}건/분`;
}

/** ISO 타임스탬프를 HH:mm:ss 형식으로 포맷 */
export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** 비용을 컴팩트하게 포맷 (예: 0.048 → "$0.048") */
export function formatCostCompact(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.001) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

/** 초를 컴팩트하게 포맷 (예: 222 → "3m 42s") */
export function formatElapsedCompact(seconds: number): string {
  if (seconds < 0) return '0s';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}
