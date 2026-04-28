import { describe, it, expect } from 'vitest';
import { computeTemporalAnomaly } from '../signals/temporal';
import type { CommentRow } from '../types';

function comment(hour: number, source = 'dcinside'): CommentRow {
  return {
    itemId: `c-${hour}-${Math.random()}`,
    parentSourceId: 'p1',
    source,
    time: new Date(`2026-04-27T${String(hour).padStart(2, '0')}:30:00Z`),
    excerpt: '',
  };
}

describe('temporal anomaly signal', () => {
  it('baseline과 동일 분포는 낮은 점수', () => {
    const baseline = Array(24).fill(1 / 24);
    const current: CommentRow[] = [];
    for (let h = 0; h < 24; h++) current.push(comment(h));
    const result = computeTemporalAnomaly(current, { dcinside: baseline });
    expect(result.score).toBeLessThan(30);
  });

  it('새벽 집중 (3~5시) 은 높은 점수', () => {
    // baseline: 평일 분포 — 9~22시 활성, 새벽 거의 없음
    const baseline = Array(24).fill(0);
    for (let h = 9; h < 23; h++) baseline[h] = 1 / 14;
    const current: CommentRow[] = [];
    for (let i = 0; i < 50; i++) current.push(comment(3 + (i % 3)));
    const result = computeTemporalAnomaly(current, { dcinside: baseline });
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('빈 입력은 confidence 0', () => {
    const baseline = Array(24).fill(1 / 24);
    const result = computeTemporalAnomaly([], { dcinside: baseline });
    expect(result.confidence).toBe(0);
  });

  it('baseline이 없으면 confidence 0', () => {
    const current: CommentRow[] = [];
    for (let i = 0; i < 60; i++) current.push(comment(10));
    // baselineBySource는 빈 객체 — dcinside 매칭 없음
    const result = computeTemporalAnomaly(current, {});
    expect(result.confidence).toBe(0);
    expect(result.metrics.skippedSources).toBe(1);
  });
});
