import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker, type Job } from 'bullmq';
import { eq, isNull, and } from 'drizzle-orm';
import {
  getDb,
  getBullMQOptions,
  videos,
  WHISPER_QUEUE_NAME,
  type WhisperJobData,
  type WhisperJobResult,
} from '@ai-signalcraft/core';
import { downloadAudio } from './download-audio.js';
import { runWhisper } from './run-whisper.js';

const LOG_PREFIX = '[whisper-worker]';

// 환경변수로 덮어쓸 수 있는 기본값
const MODEL = process.env.WHISPER_MODEL ?? 'small';
const LANGUAGE = process.env.WHISPER_LANGUAGE ?? 'ko';
const THREADS = Number(process.env.WHISPER_THREADS ?? '8');
// 동시성 1 — faster-whisper가 THREADS개 CPU를 사용하므로 병렬 실행은 CPU 경쟁만 심화
const CONCURRENCY = Number(process.env.WHISPER_CONCURRENCY ?? '1');
// 너무 긴 영상은 의미 대비 비용이 큼 — cap. 0이면 무제한
const MAX_AUDIO_DURATION_SEC = Number(process.env.WHISPER_MAX_DURATION_SEC ?? '3600'); // 60분

async function handleJob(job: Job<WhisperJobData, WhisperJobResult>): Promise<WhisperJobResult> {
  const { videoDbId, sourceId } = job.data;
  const startedAt = Date.now();

  // 이미 transcript가 채워진 영상은 skip — 중복 enqueue 방지
  const existing = await getDb()
    .select({ transcript: videos.transcript })
    .from(videos)
    .where(eq(videos.id, videoDbId))
    .limit(1);

  if (existing[0]?.transcript && existing[0].transcript.length > 0) {
    console.log(`${LOG_PREFIX} ${sourceId} 이미 transcript 존재, skip`);
    return {
      videoDbId,
      sourceId,
      charsWritten: 0,
      audioDurationSec: 0,
      transcribeElapsedSec: 0,
      lang: null,
      skipped: 'already_has_transcript',
    };
  }

  // 임시 작업 디렉토리 — 실행 종료 시 정리
  const workDir = await mkdtemp(join(tmpdir(), 'whisper-'));

  try {
    console.log(`${LOG_PREFIX} ${sourceId} audio download 시작`);
    const { path, sizeBytes } = await downloadAudio(sourceId, workDir);
    console.log(
      `${LOG_PREFIX} ${sourceId} audio ${(sizeBytes / 1024 / 1024).toFixed(1)}MB 다운로드 완료`,
    );

    console.log(`${LOG_PREFIX} ${sourceId} transcribe 시작 (model=${MODEL})`);
    const result = await runWhisper(path, {
      model: MODEL,
      language: LANGUAGE,
      threads: THREADS,
    });

    // audio가 너무 길면 잘라낸 뒤 저장 — max duration 초과 체크 (cap은 이미 whisper가 전체 처리 후)
    if (MAX_AUDIO_DURATION_SEC > 0 && result.duration > MAX_AUDIO_DURATION_SEC) {
      console.warn(
        `${LOG_PREFIX} ${sourceId} 영상 길이 ${result.duration.toFixed(0)}s > ${MAX_AUDIO_DURATION_SEC}s cap 초과 (그대로 저장하지만 비용 주의)`,
      );
    }

    // DB UPDATE — transcript 컬럼 채움
    // 다른 필드는 건드리지 않음 (수집 파이프라인이 나중에 재수집해도 충돌 없음)
    if (result.text && result.text.length > 0) {
      await getDb()
        .update(videos)
        .set({
          transcript: result.text,
          transcriptLang: result.lang,
        })
        .where(and(eq(videos.id, videoDbId), isNull(videos.transcript)));
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `${LOG_PREFIX} ${sourceId} ✅ ${result.chars}자 (${result.duration.toFixed(0)}s audio / ${result.elapsed.toFixed(1)}s whisper / ${(elapsedMs / 1000).toFixed(1)}s total)`,
    );

    return {
      videoDbId,
      sourceId,
      charsWritten: result.chars,
      audioDurationSec: result.duration,
      transcribeElapsedSec: result.elapsed,
      lang: result.lang,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} ${sourceId} 실패: ${msg}`);
    throw err; // BullMQ retry 대상
  } finally {
    // 오디오 파일·디렉토리 정리 — 성공/실패 무관
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // 이미 없어도 무방
    }
  }
}

async function main() {
  console.log(
    `${LOG_PREFIX} 시작 (model=${MODEL}, language=${LANGUAGE}, threads=${THREADS}, concurrency=${CONCURRENCY})`,
  );

  const worker = new Worker<WhisperJobData, WhisperJobResult>(WHISPER_QUEUE_NAME, handleJob, {
    ...getBullMQOptions(),
    concurrency: CONCURRENCY,
    // 한 job이 수 분~수십 분 걸릴 수 있음 — BullMQ 기본 lockDuration(30s)이면 stalled 오판
    lockDuration: 30 * 60 * 1000, // 30분
    stalledInterval: 2 * 60 * 1000, // 2분마다 stall check
    maxStalledCount: 1, // 멱등 처리 가능 — 1회 재시도 허용
  });

  worker.on('completed', (job, result) => {
    if (result.skipped) {
      console.log(`${LOG_PREFIX} ${job.id} skipped (reason=${result.skipped})`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`${LOG_PREFIX} ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`${LOG_PREFIX} error: ${err.message}`);
  });

  process.on('SIGTERM', async () => {
    console.log(`${LOG_PREFIX} SIGTERM 수신 — graceful shutdown`);
    await worker.close();
    process.exit(0);
  });

  process.on('uncaughtException', (err) => {
    console.error(`${LOG_PREFIX} FATAL uncaughtException:`, err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`${LOG_PREFIX} FATAL unhandledRejection:`, err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`${LOG_PREFIX} startup 실패:`, err);
  process.exit(1);
});
