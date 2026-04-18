// youtubei.js InnerTube 클라이언트 — API 쿼터 소진 시 fallback용
import type { Innertube } from 'youtubei.js';

let innertubeClient: Innertube | null = null;

/**
 * InnerTube 클라이언트 싱글턴 반환 (lazy loading)
 * YouTube Data API v3 쿼터 소진 시 대체 경로로 사용
 */
export async function getInnertubeClient(): Promise<Innertube> {
  if (!innertubeClient) {
    const { Innertube: InnertubeClass } = await import('youtubei.js');
    innertubeClient = await InnertubeClass.create({
      lang: 'ko',
      location: 'KR',
    });
  }
  return innertubeClient;
}

/**
 * 클라이언트 캐시 초기화 (세션 갱신 / 테스트용)
 */
export function resetInnertubeClient(): void {
  innertubeClient = null;
}
