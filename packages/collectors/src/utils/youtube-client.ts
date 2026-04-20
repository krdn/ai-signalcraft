// YouTube Data API v3 클라이언트 초기화
import { google, youtube_v3 } from 'googleapis';

let youtubeClient: youtube_v3.Youtube | null = null;

/**
 * YOUTUBE_API_KEY가 없을 때 throw되는 전용 에러.
 * 수집 실행을 "quota 소진"이 아니라 "구성 오류"로 분류하기 위해 별도 클래스 사용.
 * 호출부의 quota catch는 이 에러를 재throw해 run을 failed로 남겨야 한다.
 */
export class YoutubeApiKeyMissingError extends Error {
  constructor() {
    super('YOUTUBE_API_KEY environment variable is not set');
    this.name = 'YoutubeApiKeyMissingError';
  }
}

/**
 * googleapis YouTube 클라이언트 싱글턴 반환.
 * YOUTUBE_API_KEY 미설정 시 YoutubeApiKeyMissingError throw.
 */
export function getYoutubeClient(): youtube_v3.Youtube {
  if (!youtubeClient) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new YoutubeApiKeyMissingError();
    }
    youtubeClient = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY,
    });
  }
  return youtubeClient;
}

/**
 * 키가 설정돼 있는지만 조용히 확인 (throw 없음).
 * 워커 기동 시 헬스체크용.
 */
export function hasYoutubeApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/**
 * 테스트용: 클라이언트 캐시 초기화
 */
export function resetYoutubeClient(): void {
  youtubeClient = null;
}
