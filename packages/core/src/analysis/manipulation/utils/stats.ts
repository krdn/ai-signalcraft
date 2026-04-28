/** 중앙값. 빈 배열은 NaN. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 중앙값 절대편차 (Median Absolute Deviation). 빈 배열은 NaN. */
export function mad(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

// Nearest-rank (floor) 방법 — R type=1 / numpy lower와 동일
export function iqr(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

// p, q는 정규화된 확률분포 (합=1)이어야 한다
export function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error(`klDivergence: 길이 불일치 ${p.length} vs ${q.length}`);
  }
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] <= 0) continue;
    const qi = q[i] <= 0 ? eps : q[i];
    sum += p[i] * Math.log(p[i] / qi);
  }
  return sum;
}

export function zScore(value: number, m: number, scale: number): number {
  if (scale === 0) return 0;
  return (value - m) / scale;
}

// sigmoid로 |z|-score를 0~100 점수로 매핑
// 캘리브레이션: z=0→7.6, z=2.5→50, z=3.5→73, z=4→82, z=6→97
export function zScoreToScore(z: number): number {
  const absZ = Math.abs(z);
  // 1 / (1 + e^(-(absZ-2.5))) * 100, 0..100 클램프
  const sigmoid = 1 / (1 + Math.exp(-(absZ - 2.5) * 1.0));
  return Math.max(0, Math.min(100, sigmoid * 100));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
