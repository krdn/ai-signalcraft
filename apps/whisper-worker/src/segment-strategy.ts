import type { AudioSegment } from './download-audio.js';

/**
 * 영상 길이별 스마트 세그먼트 전략.
 *
 * 한국어 여론 분석의 정보 밀도 관찰:
 * - 도입부(앞 5분)에 주제·프레임·앵커 메시지가 집중됨
 * - 장편 토론·강의는 결론·요약이 뒤에 있을 수 있음
 * - 60분 이상 라이브 방송은 뒷부분 가치가 낮아짐 (진행자 마무리 멘트 위주)
 *
 * 한 컨테이너 CPU 예산(realtime 5-8x) 고려해 총 처리 길이 cap:
 * - ≤5m → 전체 (이미 짧음)
 * - 5-20m → 전체 (2-4분 Whisper 처리, 합리적)
 * - 20-60m → 앞5 + 뒤2 (도입 + 결론, 합계 7분)
 * - 60m+ → 앞5만 (라이브·강의의 도입부가 핵심 정보)
 * - 길이 미상 → 앞5만 (안전 기본값)
 */
export interface StrategyResult {
  name: 'full' | 'head-only' | 'head-and-tail';
  segments: AudioSegment[] | undefined; // undefined = 전체 영상 다운로드
}

export function selectSegmentStrategy(durationSec: number | null): StrategyResult {
  // 길이 미상 → 보수적으로 앞 5분만
  if (durationSec === null || durationSec <= 0) {
    return {
      name: 'head-only',
      segments: [{ label: 'head', startSec: 0, endSec: 300 }],
    };
  }

  const FIVE_MIN = 300;
  const TWENTY_MIN = 1200;
  const SIXTY_MIN = 3600;

  // ≤20분: 전체 (세그먼트 지정 불필요, segments=undefined면 전체 다운로드)
  if (durationSec <= TWENTY_MIN) {
    return { name: 'full', segments: undefined };
  }

  // 20-60분: 앞 5분 + 뒤 2분
  if (durationSec <= SIXTY_MIN) {
    return {
      name: 'head-and-tail',
      segments: [
        { label: 'head', startSec: 0, endSec: FIVE_MIN },
        // 뒤 2분 = 영상 끝 직전 120초. 음수 방지를 위해 max(0, ...)
        {
          label: 'tail',
          startSec: Math.max(FIVE_MIN, durationSec - 120),
          endSec: durationSec,
        },
      ],
    };
  }

  // 60분+: 앞 5분만
  return {
    name: 'head-only',
    segments: [{ label: 'head', startSec: 0, endSec: FIVE_MIN }],
  };
}
