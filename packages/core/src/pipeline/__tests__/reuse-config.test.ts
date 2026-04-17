import { afterEach, describe, expect, it } from 'vitest';
import {
  getArticleContentTtlSec,
  getArticleCommentTtlSec,
  getCommentTtlSecFor,
  getContentTtlSecFor,
  isReuseDisabled,
  isContentCacheDisabled,
  normalizeKeyword,
} from '../reuse-config';

describe('reuse-config', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    // 각 테스트 후 env 복원
    for (const key of [
      'ARTICLE_CONTENT_TTL_SEC',
      'ARTICLE_COMMENT_TTL_SEC',
      'VIDEO_META_TTL_SEC',
      'VIDEO_COMMENT_TTL_SEC',
      'COMMUNITY_POST_TTL_SEC',
      'DISABLE_REUSE',
      'DISABLE_CONTENT_CACHE',
    ]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  describe('TTL defaults', () => {
    it('article content 기본값 6h', () => {
      delete process.env.ARTICLE_CONTENT_TTL_SEC;
      expect(getArticleContentTtlSec()).toBe(21600);
    });

    it('article comment 기본값 30m', () => {
      delete process.env.ARTICLE_COMMENT_TTL_SEC;
      expect(getArticleCommentTtlSec()).toBe(1800);
    });

    it('env override 가 적용되어야 함', () => {
      process.env.ARTICLE_CONTENT_TTL_SEC = '7200';
      expect(getArticleContentTtlSec()).toBe(7200);
    });

    it('잘못된 env 값은 기본값으로 폴백', () => {
      process.env.ARTICLE_CONTENT_TTL_SEC = 'not-a-number';
      expect(getArticleContentTtlSec()).toBe(21600);
      process.env.ARTICLE_CONTENT_TTL_SEC = '-100';
      expect(getArticleContentTtlSec()).toBe(21600);
    });
  });

  describe('source 별 TTL 분기', () => {
    it('naver 는 article content TTL', () => {
      expect(getContentTtlSecFor('naver')).toBe(21600);
    });

    it('youtube 는 video meta TTL', () => {
      expect(getContentTtlSecFor('youtube')).toBe(43200);
    });

    it('커뮤니티는 community post TTL', () => {
      expect(getContentTtlSecFor('dcinside')).toBe(7200);
      expect(getContentTtlSecFor('fmkorea')).toBe(7200);
      expect(getContentTtlSecFor('clien')).toBe(7200);
    });

    it('알 수 없는 소스는 community 폴백', () => {
      expect(getContentTtlSecFor('nate')).toBe(7200);
    });

    it('youtube 댓글 TTL 은 video comment', () => {
      expect(getCommentTtlSecFor('youtube')).toBe(3600);
    });

    it('나머지 소스의 댓글 TTL 은 article comment', () => {
      expect(getCommentTtlSecFor('naver')).toBe(1800);
      expect(getCommentTtlSecFor('dcinside')).toBe(1800);
    });
  });

  describe('롤백 스위치', () => {
    it('DISABLE_REUSE=1 이면 true', () => {
      process.env.DISABLE_REUSE = '1';
      expect(isReuseDisabled()).toBe(true);
    });

    it('DISABLE_REUSE=true 이면 true', () => {
      process.env.DISABLE_REUSE = 'true';
      expect(isReuseDisabled()).toBe(true);
    });

    it('기본은 비활성 스위치 off', () => {
      delete process.env.DISABLE_REUSE;
      expect(isReuseDisabled()).toBe(false);
    });

    it('DISABLE_CONTENT_CACHE 별도 스위치', () => {
      delete process.env.DISABLE_CONTENT_CACHE;
      expect(isContentCacheDisabled()).toBe(false);
      process.env.DISABLE_CONTENT_CACHE = '1';
      expect(isContentCacheDisabled()).toBe(true);
    });
  });

  describe('normalizeKeyword', () => {
    it('소문자 + trim', () => {
      expect(normalizeKeyword('  Hello  ')).toBe('hello');
    });

    it('연속 공백 축약', () => {
      expect(normalizeKeyword('이재명   대선')).toBe('이재명 대선');
    });

    it('한글 대소문자 변환은 그대로', () => {
      expect(normalizeKeyword('이재명')).toBe('이재명');
    });

    it('빈 문자열 처리', () => {
      expect(normalizeKeyword('   ')).toBe('');
    });
  });
});
