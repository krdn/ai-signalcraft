import { describe, it, expect } from 'vitest';
import { computeVoteAnomaly, type VoteRow } from '../signals/vote';

function row(parent: string, length: number, likes: number): VoteRow {
  return {
    itemId: `${parent}-${length}-${likes}-${Math.random()}`,
    source: 'dcinside',
    parentSourceId: parent,
    length,
    likeCount: likes,
    time: new Date('2026-04-27T10:00:00Z'),
  };
}

describe('vote anomaly signal', () => {
  it('정상 분포는 낮은 점수', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row('p1', 50 + i, i + 1));
    const result = computeVoteAnomaly(rows);
    expect(result.score).toBeLessThan(40);
  });

  it('짧은 댓글에 비정상 추천 다수는 높은 점수', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row('p1', 50 + i, 1 + (i % 5)));
    // 짧은 댓글 5개에 매우 큰 좋아요
    for (let i = 0; i < 5; i++) rows.push(row('p1', 5, 200 + i * 50));
    const result = computeVoteAnomaly(rows);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('빈 입력은 confidence 0', () => {
    const result = computeVoteAnomaly([]);
    expect(result.confidence).toBe(0);
  });

  it('대부분 행이 작은 parent에 분산되면 confidence 하향', () => {
    // 30개 행 → 30개 parent에 1개씩 (모두 < MIN_PARENT_ROWS)
    const rows: VoteRow[] = Array.from({ length: 30 }, (_, i) => row(`p${i}`, 50 + i, i + 1));
    const result = computeVoteAnomaly(rows);
    expect(result.confidence).toBe(0);
    expect(result.metrics.analyzedCount).toBe(0);
    expect(result.metrics.skippedRows).toBe(30);
  });
});
