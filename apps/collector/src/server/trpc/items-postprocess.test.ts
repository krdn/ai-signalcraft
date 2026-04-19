import { describe, it, expect } from 'vitest';
import { limitCommentsPerParent, truncateContent, type PostProcessRow } from './items-postprocess';

describe('truncateContent', () => {
  it('maxLength 초과 content를 잘라낸다', () => {
    const rows: PostProcessRow[] = [{ content: 'a'.repeat(100) }];
    truncateContent(rows, 50);
    expect((rows[0].content as string).length).toBe(50);
  });

  it('maxLength 이하 content는 유지한다', () => {
    const rows: PostProcessRow[] = [{ content: 'short' }];
    truncateContent(rows, 50);
    expect(rows[0].content).toBe('short');
  });

  it('content가 문자열이 아니면 건드리지 않는다', () => {
    const rows: PostProcessRow[] = [{ content: null }, { content: undefined }, { content: 123 }];
    truncateContent(rows, 5);
    expect(rows[0].content).toBeNull();
    expect(rows[1].content).toBeUndefined();
    expect(rows[2].content).toBe(123);
  });

  it('maxLength가 0 또는 음수면 전체를 유지한다', () => {
    const rows: PostProcessRow[] = [{ content: 'a'.repeat(100) }];
    truncateContent(rows, 0);
    expect((rows[0].content as string).length).toBe(100);
    truncateContent(rows, -5);
    expect((rows[0].content as string).length).toBe(100);
  });

  it('여러 row를 동시에 처리한다', () => {
    const rows: PostProcessRow[] = [
      { content: 'a'.repeat(10) },
      { content: 'b'.repeat(100) },
      { content: 'c'.repeat(1000) },
    ];
    truncateContent(rows, 50);
    expect((rows[0].content as string).length).toBe(10);
    expect((rows[1].content as string).length).toBe(50);
    expect((rows[2].content as string).length).toBe(50);
  });
});

describe('limitCommentsPerParent', () => {
  it('parent별로 maxComments 개수만 남긴다', () => {
    const rows: PostProcessRow[] = [
      { itemType: 'comment', parentSourceId: 'p1', content: 'a' },
      { itemType: 'comment', parentSourceId: 'p1', content: 'b' },
      { itemType: 'comment', parentSourceId: 'p1', content: 'c' },
      { itemType: 'comment', parentSourceId: 'p2', content: 'd' },
    ];
    const result = limitCommentsPerParent(rows, 2);
    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.parentSourceId === 'p1')).toHaveLength(2);
    expect(result.filter((r) => r.parentSourceId === 'p2')).toHaveLength(1);
  });

  it('comment가 아닌 row는 필터링에서 제외한다', () => {
    const rows: PostProcessRow[] = [
      { itemType: 'article', content: 'article1' },
      { itemType: 'comment', parentSourceId: 'p1' },
      { itemType: 'comment', parentSourceId: 'p1' },
      { itemType: 'comment', parentSourceId: 'p1' },
      { itemType: 'video', content: 'video1' },
    ];
    const result = limitCommentsPerParent(rows, 1);
    expect(result).toHaveLength(3); // article + 1 comment + video
    expect(result.filter((r) => r.itemType === 'article')).toHaveLength(1);
    expect(result.filter((r) => r.itemType === 'video')).toHaveLength(1);
    expect(result.filter((r) => r.itemType === 'comment')).toHaveLength(1);
  });

  it('parentSourceId가 없으면 빈 문자열 키로 그룹핑된다', () => {
    const rows: PostProcessRow[] = [
      { itemType: 'comment' },
      { itemType: 'comment' },
      { itemType: 'comment' },
    ];
    const result = limitCommentsPerParent(rows, 2);
    expect(result).toHaveLength(2);
  });

  it('maxComments=0이면 모든 row를 유지한다(no-op)', () => {
    const rows: PostProcessRow[] = [
      { itemType: 'comment', parentSourceId: 'p1' },
      { itemType: 'comment', parentSourceId: 'p1' },
    ];
    const result = limitCommentsPerParent(rows, 0);
    expect(result).toHaveLength(2);
  });

  it('원본 배열을 변형하지 않는다(새 배열 반환)', () => {
    const rows: PostProcessRow[] = [
      { itemType: 'comment', parentSourceId: 'p1' },
      { itemType: 'comment', parentSourceId: 'p1' },
    ];
    const result = limitCommentsPerParent(rows, 1);
    expect(rows).toHaveLength(2);
    expect(result).toHaveLength(1);
  });
});
