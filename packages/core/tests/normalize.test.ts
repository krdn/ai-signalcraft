import { describe, it, expect } from 'vitest';
import {
  normalizeNaverArticle,
  normalizeNaverComment,
  normalizeYoutubeVideo,
  normalizeYoutubeComment,
} from '../src/pipeline/normalize';

describe('Normalize - NaverArticle', () => {
  it('should normalize NaverArticle to articles insert format', () => {
    const article = {
      sourceId: '016-0002042395',
      url: 'https://n.news.naver.com/article/016/0002042395',
      title: '테스트 기사',
      content: '본문 내용',
      author: null,
      publisher: '헤럴드경제',
      publishedAt: new Date('2026-03-20'),
      rawData: {},
    };
    const result = normalizeNaverArticle(article);
    expect(result.source).toBe('naver-news');
    expect(result.sourceId).toBe('016-0002042395');
    expect(result.title).toBe('테스트 기사');
    expect(result.publisher).toBe('헤럴드경제');
  });
});

describe('Normalize - NaverComment', () => {
  it('should normalize NaverComment with articleDbId FK', () => {
    const comment = {
      sourceId: 'cmt-12345',
      parentId: null,
      articleSourceId: '016-0002042395',
      content: '댓글 내용',
      author: '작성자',
      likeCount: 10,
      dislikeCount: 2,
      publishedAt: new Date('2026-03-20'),
      rawData: {},
    };
    const result = normalizeNaverComment(comment, 42);
    expect(result.source).toBe('naver-news');
    expect(result.articleId).toBe(42);
    expect(result.videoId).toBeNull();
    expect(result.likeCount).toBe(10);
  });

  it('should handle missing articleDbId as null', () => {
    const comment = {
      sourceId: 'cmt-12345',
      parentId: null,
      articleSourceId: '016-0002042395',
      content: '댓글 내용',
      author: '작성자',
      likeCount: 0,
      dislikeCount: 0,
      publishedAt: null,
      rawData: {},
    };
    const result = normalizeNaverComment(comment);
    expect(result.articleId).toBeNull();
  });
});

describe('Normalize - YoutubeVideo', () => {
  it('should normalize YoutubeVideo to videos insert format', () => {
    const video = {
      sourceId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: '테스트 영상',
      description: '설명',
      channelId: 'UC123',
      channelTitle: '테스트 채널',
      viewCount: 1000,
      likeCount: 100,
      commentCount: 50,
      publishedAt: new Date('2026-03-20'),
      rawData: {},
    };
    const result = normalizeYoutubeVideo(video);
    expect(result.source).toBe('youtube');
    expect(result.sourceId).toBe('dQw4w9WgXcQ');
    expect(result.viewCount).toBe(1000);
    expect(result.channelTitle).toBe('테스트 채널');
  });
});

describe('Normalize - YoutubeComment', () => {
  it('should normalize YoutubeComment with videoDbId FK', () => {
    const comment = {
      sourceId: 'yt-cmt-001',
      parentId: null,
      videoSourceId: 'dQw4w9WgXcQ',
      content: '유튜브 댓글',
      author: '유저',
      likeCount: 5,
      publishedAt: new Date('2026-03-20'),
      rawData: {},
    };
    const result = normalizeYoutubeComment(comment, 99);
    expect(result.source).toBe('youtube');
    expect(result.videoId).toBe(99);
    expect(result.articleId).toBeNull();
    expect(result.dislikeCount).toBe(0);
  });
});
