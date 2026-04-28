import { clamp, median } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

const MIN_POINTS = 8;
const FULL_CONFIDENCE_POINTS = 14;
const JUMP_RATIO_EVIDENCE_THRESHOLD = 5;
const JUMP_RATIO_HIGH_THRESHOLD = 20;
const JUMP_RATIO_MEDIUM_THRESHOLD = 10;
const CHANGE_POINT_RATIO = 5; // detectChangePoint: 1-step 차분이 초기 baseline의 N배 이상 시 변화점
const FLATNESS_WINDOW_SIZE = 5; // post-peak 윈도우 (peak 포함 5점)

export type TrendPoint = { ts: string; count: number };

/**
 * 인공 트렌드 모양 (jump ratio + 평탄도) 계산.
 *
 * @param series 시계열 (예: dailyMentionTrend) — `ts`는 ISO 문자열, `count`는 해당 구간 카운트
 * @returns SignalResult — score = log10(jumpRatio+1)*30 + flatness*40 (0..100)
 *
 * - jumpRatio: peak 값 / pre-peak **median** (스파이크 오염 방지). pre-peak가 비면 baseline=1
 * - flatness: peak **이후** 5점 윈도우의 변동계수 역수 (1 - cv, 0..1 clamp).
 *   **단, changePoint가 검출되지 않은 경우 (자연 확산) 0으로 게이트**.
 *   가우시안 같은 부드러운 곡선도 peak 주변은 국소적으로 평평하므로,
 *   "급등 직후의 plateau" 라는 인공 트렌드 의미를 살리려면 changePoint 게이트가 필요.
 *   윈도우는 post-peak 위주 — pre-jump 값(예: baseline=1)이 섞이면 plateau 측정이 왜곡됨.
 * - confidence: series.length / FULL_CONFIDENCE_POINTS (0..1)
 * - 짧은 시리즈 (MIN_POINTS 미만) 는 score=0, 부분 confidence 만 반환
 * - peakIdx === 0 (descending 시리즈) 도 score=0 — pre-peak baseline 없어 의미 있는 jumpRatio 산출 불가
 */
export function computeTrendShape(series: TrendPoint[]): SignalResult {
  const t0 = Date.now();
  if (series.length < MIN_POINTS) {
    return {
      signal: 'trend-shape',
      score: 0,
      confidence: Math.min(1, series.length / MIN_POINTS),
      evidence: [],
      metrics: { jumpRatio: 0, points: series.length },
      computeMs: Date.now() - t0,
    };
  }

  const counts = series.map((p) => p.count);
  const max = Math.max(...counts);
  const peakIdx = counts.indexOf(max);

  // 가드: peak가 series 시작 지점이면 pre-peak baseline 없음 → 의미 있는 jumpRatio 산출 불가
  if (peakIdx === 0) {
    return {
      signal: 'trend-shape',
      score: 0,
      confidence: Math.min(1, series.length / FULL_CONFIDENCE_POINTS),
      evidence: [],
      metrics: { jumpRatio: 0, flatness: 0, points: series.length, peakAtStart: 1 },
      computeMs: Date.now() - t0,
    };
  }

  const prePeak = counts.slice(0, peakIdx);
  // median은 prePeak에 spike(이미 상승한 값)가 끼어 있어도 baseline을 왜곡하지 않음
  const baseline = prePeak.length > 0 ? Math.max(1, median(prePeak)) : 1;
  const jumpRatio = max / baseline;

  const changeIdx = detectChangePoint(counts);

  // 평탄도: post-jump plateau 측정 — peak 포함 이후 5점 윈도우. changePoint 없으면 0으로 게이트
  let flatness = 0;
  if (changeIdx >= 0) {
    const window = counts.slice(peakIdx, Math.min(counts.length, peakIdx + FLATNESS_WINDOW_SIZE));
    const cv = stdDev(window) / (average(window) || 1);
    flatness = clamp(1 - cv, 0, 1);
  }

  const score = clamp(Math.log10(jumpRatio + 1) * 30 + flatness * 40, 0, 100);
  const confidence = Math.min(1, series.length / FULL_CONFIDENCE_POINTS);

  const evidence: EvidenceCard[] = [];
  if (jumpRatio >= JUMP_RATIO_EVIDENCE_THRESHOLD) {
    evidence.push({
      signal: 'trend-shape',
      severity:
        jumpRatio >= JUMP_RATIO_HIGH_THRESHOLD
          ? 'high'
          : jumpRatio >= JUMP_RATIO_MEDIUM_THRESHOLD
            ? 'medium'
            : 'low',
      title: `평소 대비 ${jumpRatio.toFixed(1)}배 급등 (평탄도 ${flatness.toFixed(2)})`,
      summary: `${series[peakIdx].ts} 부근 피크`,
      visualization: {
        kind: 'trend-line',
        series: series.map((p, i) => ({
          ts: p.ts,
          count: p.count,
          isChangePoint: i === changeIdx,
        })),
      },
      rawRefs: [],
      rank: 0,
    });
  }

  return {
    signal: 'trend-shape',
    score,
    confidence,
    evidence,
    metrics: { jumpRatio, flatness, points: series.length },
    computeMs: Date.now() - t0,
  };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = average(arr);
  return Math.sqrt(average(arr.map((v) => (v - m) ** 2)));
}

// 단순 ratio rule 변화점: 1차 차분이 baseline의 5배 이상인 첫 인덱스
function detectChangePoint(counts: number[]): number {
  if (counts.length < 3) return -1;
  const first3Avg = average(counts.slice(0, 3)) || 1;
  for (let i = 3; i < counts.length; i++) {
    if (counts[i] - counts[i - 1] >= first3Avg * CHANGE_POINT_RATIO) return i;
  }
  return -1;
}
