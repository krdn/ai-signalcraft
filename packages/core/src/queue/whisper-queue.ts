import { Queue } from 'bullmq';
import { getBullMQOptions } from './connection';

/**
 * Whisper 전사 큐.
 *
 * YouTube 자막 엔드포인트가 PO token 보호로 막힌 이후, 조회수 상위 영상의 오디오를
 * yt-dlp로 다운로드 → faster-whisper로 전사해 videos.transcript 컬럼을 채운다.
 *
 * 파이프라인: pipeline-worker가 persist-youtube 단계에서 Top-N을 선별해 이 큐에 push.
 * 소비자: apps/whisper-worker (별도 컨테이너).
 *
 * 왜 별도 큐인가:
 *   - 전사는 느리고(영상당 수십 초~수 분), 수집 파이프라인을 블록하면 분석 트리거 지연
 *   - CPU 사용 패턴이 수집과 다름 — 독립 스케일링 필요
 */
export const WHISPER_QUEUE_NAME = 'whisper';

/**
 * 전사 결과를 어디에 쓸지 식별. 미설정 시 legacy(videos.id) 경로.
 * 신규 키워드 구독 경로(ais_collection.raw_items)에는 target.kind='raw_items'로 enqueue.
 */
export type WhisperTarget = {
  kind: 'raw_items';
  source: string;
  rawSourceId: string;
  itemType: 'video';
};

export interface WhisperJobData {
  /** YouTube videoId — yt-dlp로 다운로드할 영상 식별자 */
  sourceId: string;
  /** 원 구독/트리거 키 — 로그 추적용 */
  subscriptionId?: number;
  /** 조회수 — 우선순위 판단용 (큰 값 먼저) */
  viewCount?: number;
  /** 신규 경로 — raw_items 식별자 */
  target?: WhisperTarget;
  /** legacy 호환 — videos.id (DB PK). target 미설정 시 이 경로 사용 */
  videoDbId?: number;
}

export interface WhisperJobResult {
  /** legacy 경로일 때만 채워짐 */
  videoDbId?: number;
  sourceId: string;
  charsWritten: number;
  audioDurationSec: number;
  transcribeElapsedSec: number;
  lang: string | null;
  skipped?: 'no_audio' | 'whisper_failed' | 'already_has_transcript';
}

let _queue: Queue<WhisperJobData, WhisperJobResult> | null = null;

/**
 * Whisper 큐 인스턴스 (lazy).
 * pipeline-worker가 enqueue할 때 사용.
 */
export function getWhisperQueue(): Queue<WhisperJobData, WhisperJobResult> {
  if (!_queue) {
    _queue = new Queue<WhisperJobData, WhisperJobResult>(WHISPER_QUEUE_NAME, getBullMQOptions());
  }
  return _queue;
}
