// P1 패치 검증: RAG 폴백이 시계열 균등인지 확인 (job 266 분포 모방)
import { describe, it, expect } from 'vitest';
import { calculateBudget, stratifiedSample } from '../src/analysis/sampling';

describe('P1 RAG 폴백 시계열 균등 샘플링', () => {
  it('4/22~23에 폭증한 7일치 351개 → 130개 샘플이 4/16~21에도 분배된다', () => {
    const dateRange = { start: new Date('2026-04-16'), end: new Date('2026-04-23T23:59:59') };
    const articles: Array<{ publishedAt: Date; day: number }> = [];
    const dayCounts = [34, 14, 43, 17, 122, 151, 1221, 689]; // job 266 published_at 분포

    for (let d = 0; d < 8; d++) {
      for (let i = 0; i < dayCounts[d]; i++) {
        const t = new Date(dateRange.start);
        t.setDate(t.getDate() + d);
        t.setHours(Math.floor(Math.random() * 24));
        articles.push({ publishedAt: t, day: d });
      }
    }

    const limit = 130;
    const budget = calculateBudget({
      dateRange,
      totalArticles: 0,
      totalComments: articles.length,
      totalVideos: 0,
    });
    const tuned = {
      ...budget,
      targets: { ...budget.targets, comments: limit },
      minimums: {
        ...budget.minimums,
        comments: Math.max(1, Math.floor(limit / Math.max(1, budget.binCount))),
      },
    };

    const result = stratifiedSample(
      articles,
      tuned,
      (a) => a.publishedAt,
      () => null,
    );
    const dayHist: Record<number, number> = {};
    for (const s of result.sampled) dayHist[s.day] = (dayHist[s.day] ?? 0) + 1;

    // 모든 8일 모두 1개 이상 샘플링됐어야 함 (이전 최신순 폴백이면 day=6,7만 채워짐)
    for (let d = 0; d < 8; d++) {
      expect(dayHist[d] ?? 0).toBeGreaterThan(0);
    }
    // 샘플 총 개수가 limit과 거의 일치
    expect(result.sampled.length).toBeGreaterThanOrEqual(limit - 8);
    expect(result.sampled.length).toBeLessThanOrEqual(limit + 8);

    // 폭증일(day=6, 1221개)이 limit의 절반을 넘기지 않아야 함 (시간 균등 보존)
    expect(dayHist[6] ?? 0).toBeLessThan(limit * 0.6);
  });
});
