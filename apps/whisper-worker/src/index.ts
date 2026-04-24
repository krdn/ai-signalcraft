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
import { selectSegmentStrategy } from './segment-strategy.js';

const LOG_PREFIX = '[whisper-worker]';

// 환경변수로 덮어쓸 수 있는 기본값
const MODEL = process.env.WHISPER_MODEL ?? 'small';
const LANGUAGE = process.env.WHISPER_LANGUAGE ?? 'ko';
const THREADS = Number(process.env.WHISPER_THREADS ?? '8');
// 동시성 1 — faster-whisper가 THREADS개 CPU를 사용하므로 병렬 실행은 CPU 경쟁만 심화
const CONCURRENCY = Number(process.env.WHISPER_CONCURRENCY ?? '1');

async function handleJob(job: Job<WhisperJobData, WhisperJobResult>): Promise<WhisperJobResult> {
  const { videoDbId, sourceId } = job.data;
  const startedAt = Date.now();

  // 영상 메타 조회 — 이미 transcript 있으면 skip, duration으로 전략 선택
  const existing = await getDb()
    .select({ transcript: videos.transcript, durationSec: videos.durationSec })
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

  const durationSec = existing[0]?.durationSec ?? null;
  const strategy = selectSegmentStrategy(durationSec);
  console.log(
    `${LOG_PREFIX} ${sourceId} strategy=${strategy.name} (duration=${durationSec ?? 'unknown'}s)`,
  );

  // 임시 작업 디렉토리 — 실행 종료 시 정리
  const workDir = await mkdtemp(join(tmpdir(), 'whisper-'));

  try {
    // 세그먼트(또는 전체) 다운로드 — 1개 또는 2개 파일
    const downloaded = await downloadAudio(sourceId, workDir, strategy.segments);
    const totalBytes = downloaded.reduce((sum, d) => sum + d.sizeBytes, 0);
    console.log(
      `${LOG_PREFIX} ${sourceId} audio ${(totalBytes / 1024 / 1024).toFixed(1)}MB 다운로드 (${downloaded.length}개 세그먼트)`,
    );

    // 각 세그먼트 Whisper 전사 — 파일별 독립 호출
    // 이유: 세그먼트를 concat하면 seam에서 말이 잘려 텍스트가 어색해짐.
    //       별도 호출 후 "\n\n"으로 이어붙이는 것이 fidelity가 높음.
    const pieces: { label: string; text: string; elapsed: number; audioSec: number }[] = [];
    let detectedLang: string | null = null;

    for (const seg of downloaded) {
      const result = await runWhisper(seg.path, {
        model: MODEL,
        language: LANGUAGE,
        threads: THREADS,
      });
      if (!detectedLang) detectedLang = result.lang;
      pieces.push({
        label: seg.label,
        text: result.text,
        elapsed: result.elapsed,
        audioSec: result.duration,
      });
      console.log(
        `${LOG_PREFIX} ${sourceId} [${seg.label}] ${result.chars}자 (${result.duration.toFixed(0)}s audio / ${result.elapsed.toFixed(1)}s whisper)`,
      );
    }

    // 세그먼트 텍스트를 라벨과 함께 이어붙임 — 분석 모듈이 구분 인지 가능
    const combinedText =
      pieces.length === 1
        ? pieces[0].text
        : pieces
            .map((p) => (p.text.length > 0 ? `[${p.label}]\n${p.text}` : ''))
            .filter(Boolean)
            .join('\n\n');
    const totalAudio = pieces.reduce((sum, p) => sum + p.audioSec, 0);
    const totalElapsed = pieces.reduce((sum, p) => sum + p.elapsed, 0);

    // DB UPDATE — transcript 컬럼 채움
    // WHERE transcript IS NULL — 다른 경로로 이미 채워졌으면 덮어쓰지 않음
    if (combinedText.length > 0) {
      await getDb()
        .update(videos)
        .set({
          transcript: combinedText,
          transcriptLang: detectedLang,
        })
        .where(and(eq(videos.id, videoDbId), isNull(videos.transcript)));
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `${LOG_PREFIX} ${sourceId} ✅ ${combinedText.length}자 (strategy=${strategy.name} / ${totalAudio.toFixed(0)}s audio / ${totalElapsed.toFixed(1)}s whisper / ${(elapsedMs / 1000).toFixed(1)}s total)`,
    );

    return {
      videoDbId,
      sourceId,
      charsWritten: combinedText.length,
      audioDurationSec: totalAudio,
      transcribeElapsedSec: totalElapsed,
      lang: detectedLang,
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
