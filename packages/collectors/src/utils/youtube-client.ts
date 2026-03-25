// YouTube Data API v3 클라이언트 초기화
import { google, youtube_v3 } from 'googleapis';

let youtubeClient: youtube_v3.Youtube | null = null;

/**
 * googleapis YouTube 클라이언트 싱글턴 반환
 * YOUTUBE_API_KEY 환경변수 필수
 */
export function getYoutubeClient(): youtube_v3.Youtube | null {
  if (!youtubeClient) {
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('[YouTube] YOUTUBE_API_KEY 미설정 -- 수집 건너뜀');
      return null;
    }
    youtubeClient = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });
  }
  return youtubeClient;
}

/**
 * 테스트용: 클라이언트 캐시 초기화
 */
export function resetYoutubeClient(): void {
  youtubeClient = null;
}
