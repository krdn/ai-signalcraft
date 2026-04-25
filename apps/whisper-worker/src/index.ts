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
  type WhisperTarget,
} from '@ai-signalcraft/core';
import { downloadAudio } from './download-audio.js';
import { runWhisper } from './run-whisper.js';
import { selectSegmentStrategy } from './segment-strategy.js';
import { closeCollectorDb, getCollectorDb } from './db-collector.js';

const LOG_PREFIX = '[whisper-worker]';

const MODEL = process.env.WHISPER_MODEL ?? 'small';
const LANGUAGE = process.env.WHISPER_LANGUAGE ?? 'ko';
const THREADS = Number(process.env.WHISPER_THREADS ?? '8');
// 동시성 1 — faster-whisper가 THREADS개 CPU를 사용하므로 병렬 실행은 CPU 경쟁만 심화
const CONCURRENCY = Number(process.env.WHISPER_CONCURRENCY ?? '1');

interface ExistingState {
  hasTranscript: boolean;
  durationSec: number | null;
}

async function readLegacyState(videoDbId: number): Promise<ExistingState> {
  const rows = await getDb()
    .select({ transcript: videos.transcript, durationSec: videos.durationSec })
    .from(videos)
    .where(eq(videos.id, videoDbId))
    .limit(1);
  const row = rows[0];
  return {
    hasTranscript: !!row?.transcript && row.transcript.length > 0,
    durationSec: row?.durationSec ?? null,
  };
}

async function readRawItemsState(target: WhisperTarget): Promise<ExistingState> {
  // 같은 sourceId가 여러 row에 있으면 가장 최근 row 기준. UNIQUE 키에 time이 포함된
  // 하이퍼테이블 특성상 재수집 시 같은 영상이 다른 time으로 적재될 수 있음.
  const result = await getCollectorDb().query<{
    t: string | null;
    d: number | null;
  }>(
    `SELECT raw_payload->>'transcript' AS t,
            (raw_payload->>'durationSec')::int AS d
       FROM raw_items
      WHERE source = $1 AND source_id = $2 AND item_type = $3
      ORDER BY time DESC LIMIT 1`,
    [target.source, target.rawSourceId, target.itemType],
  );
  const row = result.rows[0];
  return {
    hasTranscript: !!row?.t && row.t.length > 0,
    durationSec: row?.d ?? null,
  };
}

async function writeLegacyTranscript(
  videoDbId: number,
  combinedText: string,
  detectedLang: string | null,
): Promise<void> {
  // WHERE transcript IS NULL — 다른 경로로 이미 채워졌으면 덮어쓰지 않음
  await getDb()
    .update(videos)
    .set({ transcript: combinedText, transcriptLang: detectedLang })
    .where(and(eq(videos.id, videoDbId), isNull(videos.transcript)));
}

async function writeRawItemsTranscript(
  target: WhisperTarget,
  combinedText: string,
  detectedLang: string | null,
): Promise<number> {
  // jsonb 머지로 raw_payload 다른 키 보존. time 무관하게 같은 sourceId 모든 row 갱신.
  const result = await getCollectorDb().query(
    `UPDATE raw_items
        SET raw_payload = raw_payload
          || jsonb_build_object('transcript', $4::text, 'transcriptLang', $5::text)
      WHERE source = $1 AND source_id = $2 AND item_type = $3
        AND COALESCE(raw_payload->>'transcript', '') = ''`,
    [target.source, target.rawSourceId, target.itemType, combinedText, detectedLang],
  );
  return result.rowCount ?? 0;
}

async function handleJob(job: Job<WhisperJobData, WhisperJobResult>): Promise<WhisperJobResult> {
  const { sourceId, videoDbId, target } = job.data;
  const startedAt = Date.now();

  if (!target && videoDbId === undefined) {
    throw new Error(
      `whisper job ${job.id} has neither target nor videoDbId — payload incompatible`,
    );
  }

  const existing: ExistingState = target
    ? await readRawItemsState(target)
    : await readLegacyState(videoDbId as number);

  if (existing.hasTranscript) {
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

  const strategy = selectSegmentStrategy(existing.durationSec);
  console.log(
    `${LOG_PREFIX} ${sourceId} target=${target ? 'raw_items' : 'legacy'} strategy=${strategy.name} (duration=${existing.durationSec ?? 'unknown'}s)`,
  );

  const workDir = await mkdtemp(join(tmpdir(), 'whisper-'));

  try {
    const downloaded = await downloadAudio(sourceId, workDir, strategy.segments);
    const totalBytes = downloaded.reduce((sum, d) => sum + d.sizeBytes, 0);
    console.log(
      `${LOG_PREFIX} ${sourceId} audio ${(totalBytes / 1024 / 1024).toFixed(1)}MB 다운로드 (${downloaded.length}개 세그먼트)`,
    );

    // 세그먼트별 독립 Whisper 호출. concat 시 seam에서 말이 잘려 fidelity 저하.
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

    const combinedText =
      pieces.length === 1
        ? pieces[0].text
        : pieces
            .map((p) => (p.text.length > 0 ? `[${p.label}]\n${p.text}` : ''))
            .filter(Boolean)
            .join('\n\n');
    const totalAudio = pieces.reduce((sum, p) => sum + p.audioSec, 0);
    const totalElapsed = pieces.reduce((sum, p) => sum + p.elapsed, 0);

    let updatedRows = 0;
    if (combinedText.length > 0) {
      if (target) {
        updatedRows = await writeRawItemsTranscript(target, combinedText, detectedLang);
      } else {
        await writeLegacyTranscript(videoDbId as number, combinedText, detectedLang);
        updatedRows = 1;
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `${LOG_PREFIX} ${sourceId} ✅ ${combinedText.length}자, ${updatedRows}row UPDATE (strategy=${strategy.name} / ${totalAudio.toFixed(0)}s audio / ${totalElapsed.toFixed(1)}s whisper / ${(elapsedMs / 1000).toFixed(1)}s total)`,
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
    throw err;
  } finally {
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
    // 한 job이 수 분~수십 분 걸릴 수 있음 — 기본 lockDuration(30s)은 stalled 오판
    lockDuration: 30 * 60 * 1000,
    stalledInterval: 2 * 60 * 1000,
    maxStalledCount: 1,
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
    await closeCollectorDb();
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
