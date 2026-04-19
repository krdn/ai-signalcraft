import { describe, it, expect } from 'vitest';
import { buildEmbeddingText } from './embedding';

describe('buildEmbeddingText', () => {
  it('title과 content를 두 줄 공백으로 결합한다', () => {
    const text = buildEmbeddingText('제목', '본문');
    expect(text).toBe('제목\n\n본문');
  });

  it('title만 있으면 title만 반환한다', () => {
    expect(buildEmbeddingText('제목만', null)).toBe('제목만');
  });

  it('content만 있으면 content만 반환한다', () => {
    expect(buildEmbeddingText(null, '본문만')).toBe('본문만');
  });

  it('둘 다 null이면 빈 문자열', () => {
    expect(buildEmbeddingText(null, null)).toBe('');
  });

  it('2000자를 넘으면 잘라낸다 (E5 토큰 제한 대응)', () => {
    const huge = 'a'.repeat(5000);
    const text = buildEmbeddingText('t', huge);
    expect(text.length).toBe(2000);
    expect(text.startsWith('t\n\naaa')).toBe(true);
  });

  it('정확히 2000자 경계를 준수한다', () => {
    const s = 'x'.repeat(2000);
    expect(buildEmbeddingText(null, s).length).toBe(2000);
    expect(buildEmbeddingText(null, 'x'.repeat(1999)).length).toBe(1999);
  });
});
