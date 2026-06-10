import { describe, it, expect } from 'vitest';
import { dedupeLatestRunRows } from './stalled-dedupe';

describe('dedupeLatestRunRows', () => {
  it('같은 (runId, source) 중복 시 최신(앞쪽) 행만 남긴다', () => {
    const rows = [
      { runId: 'a', source: 'naver-comments', time: new Date('2026-06-10T08:00:00Z') },
      { runId: 'a', source: 'naver-comments', time: new Date('2026-06-10T05:00:00Z') },
      { runId: 'a', source: 'naver-news', time: new Date('2026-06-10T05:00:00Z') },
    ];

    const result = dedupeLatestRunRows(rows);

    expect(result).toHaveLength(2);
    expect(result[0].time.toISOString()).toBe('2026-06-10T08:00:00.000Z');
    expect(result.map((r) => `${r.runId}-${r.source}`)).toEqual([
      'a-naver-comments',
      'a-naver-news',
    ]);
  });

  it('중복이 없으면 그대로 반환', () => {
    const rows = [
      { runId: 'a', source: 'naver-news' },
      { runId: 'b', source: 'naver-news' },
      { runId: 'a', source: 'youtube' },
    ];
    expect(dedupeLatestRunRows(rows)).toHaveLength(3);
  });

  it('빈 배열은 빈 배열 반환', () => {
    expect(dedupeLatestRunRows([])).toEqual([]);
  });
});
