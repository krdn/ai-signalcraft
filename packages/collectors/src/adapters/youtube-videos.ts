// YouTube 영상 메타데이터 수집기 (YouTube Data API v3)
import { getYoutubeClient } from '../utils/youtube-client';
import type { Collector, CollectionOptions } from './base';

/** 수집된 YouTube 영상 메타데이터 */
export interface YoutubeVideo {
  sourceId: string; // videoId
  url: string; // https://www.youtube.com/watch?v={videoId}
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
}

// 기본 최대 수집 건수
const DEFAULT_MAX_ITEMS = 50;
// search.list 한 페이지 최대 결과 수
const SEARCH_PAGE_SIZE = 50;

/**
 * YoutubeVideosCollector
 *
 * YouTube Data API v3의 search.list + videos.list를 조합하여
 * 키워드 기반 영상 메타데이터를 수집한다.
 *
 * 쿼터 효율:
 * - search.list: 100유닛/요청 (videoId 목록 획득)
 * - videos.list: 1유닛/요청 (최대 50개 영상 상세 정보)
 * - 50건 수집 시 총 101유닛 소모
 */
export class YoutubeVideosCollector implements Collector<YoutubeVideo> {
  readonly source = 'youtube-videos';

  /**
   * 키워드 기반 YouTube 영상 메타데이터 수집
   * 페이지 단위(최대 50건)로 yield
   */
  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeVideo[], void, unknown> {
    const youtube = getYoutubeClient();
    if (!youtube) return; // API 키 미설정 시 빈 결과
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    let totalCollected = 0;
    let nextPageToken: string | undefined;
    // TTL 재사용: 완전 스킵 URL 은 videos.list 응답에서 제외 후 yield
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    let skippedByReuse = 0;

    while (totalCollected < maxItems) {
      // Step 1: search.list -- 키워드로 영상 검색 (100유닛/요청)
      const remaining = maxItems - totalCollected;
      const pageSize = Math.min(remaining, SEARCH_PAGE_SIZE);

      const searchResponse = await youtube.search.list({
        part: ['id'],
        q: options.keyword,
        type: ['video'],
        publishedAfter: options.startDate,
        publishedBefore: options.endDate,
        maxResults: pageSize,
        order: 'date',
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        pageToken: nextPageToken,
      });

      const searchItems = searchResponse.data.items;
      if (!searchItems || searchItems.length === 0) break;

      // videoId 목록 추출
      const videoIds = searchItems
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id));

      if (videoIds.length === 0) break;

      // Step 2: videos.list -- 상세 정보 조회 (1유닛/요청, 최대 50개)
      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds,
      });

      const videoItems = videosResponse.data.items;
      if (!videoItems || videoItems.length === 0) break;

      // YoutubeVideo 객체로 변환
      const videos: YoutubeVideo[] = videoItems.map((item) => ({
        sourceId: item.id ?? '',
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? null,
        channelId: item.snippet?.channelId ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
        likeCount: parseInt(item.statistics?.likeCount ?? '0', 10),
        commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
        publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
        rawData: item as unknown as Record<string, unknown>,
      }));

      // TTL 재사용: skipUrls 에 포함된 영상은 제외 (이미 flows 에서 video_jobs 재연결됨)
      const filteredVideos = videos.filter((v) => {
        if (skipUrlSet.has(v.url)) {
          skippedByReuse++;
          return false;
        }
        return true;
      });

      totalCollected += filteredVideos.length;
      if (filteredVideos.length > 0) yield filteredVideos;

      // 다음 페이지 토큰 확인
      nextPageToken = searchResponse.data.nextPageToken ?? undefined;
      if (!nextPageToken) break;
    }

    if (skippedByReuse > 0) {
      console.info(`youtube-videos TTL 재사용으로 ${skippedByReuse}건 메타데이터 수집 스킵`);
    }
  }
}
