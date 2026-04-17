import { describe, expect, it } from 'vitest';
import { dedupeBySourceId } from '../dedupe';

type Row = { source: string; sourceId: string; payload?: string };

describe('dedupeBySourceId', () => {
  it('빈 배열은 빈 결과를 반환한다', () => {
    const { deduped, dropped, ratio } = dedupeBySourceId<Row>([]);
    expect(deduped).toEqual([]);
    expect(dropped).toBe(0);
    expect(ratio).toBe(0);
  });

  it('중복 없는 배열은 그대로 반환된다', () => {
    const rows: Row[] = [
      { source: 'naver-news', sourceId: 'a' },
      { source: 'naver-news', sourceId: 'b' },
      { source: 'youtube', sourceId: 'a' }, // 다른 source + 같은 sourceId는 별개
    ];
    const { deduped, dropped } = dedupeBySourceId(rows);
    expect(deduped).toHaveLength(3);
    expect(dropped).toBe(0);
  });

  it('같은 (source, sourceId) 중복은 제거되며 마지막 값이 유지된다', () => {
    const rows: Row[] = [
      { source: 'youtube', sourceId: 'v1', payload: 'first' },
      { source: 'youtube', sourceId: 'v2', payload: 'solo' },
      { source: 'youtube', sourceId: 'v1', payload: 'second' },
      { source: 'youtube', sourceId: 'v1', payload: 'third' },
    ];
    const { deduped, dropped, ratio } = dedupeBySourceId(rows);
    expect(deduped).toHaveLength(2);
    expect(dropped).toBe(2);
    expect(ratio).toBeCloseTo(0.5);
    const v1 = deduped.find((r) => r.sourceId === 'v1');
    expect(v1?.payload).toBe('third');
  });

  it('source가 다르면 같은 sourceId라도 중복 아님', () => {
    const rows: Row[] = [
      { source: 'naver-news', sourceId: 'x' },
      { source: 'dcinside', sourceId: 'x' },
      { source: 'fmkorea', sourceId: 'x' },
    ];
    const { deduped, dropped } = dedupeBySourceId(rows);
    expect(deduped).toHaveLength(3);
    expect(dropped).toBe(0);
  });

  it('ratio는 dropped / data.length로 계산된다', () => {
    const rows: Row[] = [
      { source: 'y', sourceId: '1' },
      { source: 'y', sourceId: '1' },
      { source: 'y', sourceId: '1' },
      { source: 'y', sourceId: '2' },
    ];
    const { dropped, ratio } = dedupeBySourceId(rows);
    expect(dropped).toBe(2);
    expect(ratio).toBeCloseTo(0.5);
  });
});
