// subscriptions 라우터 Zod 입력 검증 회귀 테스트.
//
// 라우터 mutation 본체는 DB/queue 의존성이 커서 통합 테스트가 적합하지만,
// 입력 검증은 schema 단위로 빠르게 회귀 검증할 수 있다.
// keyword/sources 길이 제한, intervalHours 범위, limits 양수 같은
// 사용자 인터페이스 계약을 PR 머지 전에 확정한다.
import { describe, it, expect } from 'vitest';
import { createInput, limitsSchema, updateInput } from '../subscriptions';

describe('subscriptions.create 입력 스키마', () => {
  it('정상 입력 통과 + intervalHours 기본값 6 적용', () => {
    const result = createInput.safeParse({
      keyword: '한동훈',
      sources: ['naver-news', 'youtube'],
      limits: { maxPerRun: 500 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intervalHours).toBe(6);
    }
  });

  it('keyword 빈 문자열 거부', () => {
    const result = createInput.safeParse({
      keyword: '',
      sources: ['naver-news'],
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('keyword 200자 초과 거부', () => {
    const result = createInput.safeParse({
      keyword: 'a'.repeat(201),
      sources: ['naver-news'],
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('sources 빈 배열 거부 (min 1)', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: [],
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('sources에 알 수 없는 값 거부', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: ['unknown-source'],
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('intervalHours 0 이하 거부', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: ['naver-news'],
      intervalHours: 0,
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('intervalHours 24*7=168 초과 거부', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: ['naver-news'],
      intervalHours: 169,
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(false);
  });

  it('intervalHours 정확히 168 통과', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: ['naver-news'],
      intervalHours: 168,
      limits: { maxPerRun: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('limits.maxPerRun 0 또는 음수 거부', () => {
    expect(
      createInput.safeParse({
        keyword: 'test',
        sources: ['naver-news'],
        limits: { maxPerRun: 0 },
      }).success,
    ).toBe(false);
    expect(
      createInput.safeParse({
        keyword: 'test',
        sources: ['naver-news'],
        limits: { maxPerRun: -1 },
      }).success,
    ).toBe(false);
  });

  it('limits.commentsPerItem 0 허용 (nonnegative)', () => {
    const result = limitsSchema.safeParse({
      maxPerRun: 100,
      commentsPerItem: 0,
    });
    expect(result.success).toBe(true);
  });

  it('options 미지정 통과', () => {
    const result = createInput.safeParse({
      keyword: 'test',
      sources: ['clien'],
      limits: { maxPerRun: 50 },
    });
    expect(result.success).toBe(true);
  });
});

describe('subscriptions.update 입력 스키마', () => {
  it('id만으로도 통과 (모든 필드 partial)', () => {
    const result = updateInput.safeParse({ id: 1 });
    expect(result.success).toBe(true);
  });

  it('id 없으면 거부', () => {
    const result = updateInput.safeParse({ keyword: 'test' });
    expect(result.success).toBe(false);
  });

  it('id 음수/0 거부', () => {
    expect(updateInput.safeParse({ id: 0 }).success).toBe(false);
    expect(updateInput.safeParse({ id: -1 }).success).toBe(false);
  });

  it('id + 일부 필드 부분 업데이트 통과', () => {
    const result = updateInput.safeParse({
      id: 5,
      keyword: 'updated',
      intervalHours: 12,
    });
    expect(result.success).toBe(true);
  });

  it('partial이지만 sources를 빈 배열로 업데이트는 거부 (min 1 유지)', () => {
    const result = updateInput.safeParse({ id: 1, sources: [] });
    expect(result.success).toBe(false);
  });
});
