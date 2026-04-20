import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { getBullMQOptions } from '../src/queue/connection';

/**
 * Worker 외부에서 active job을 force failed로 보낼 수 있는지 검증.
 * BullMQ 5.x의 moveToFailed는 worker processor 내부에서만 token을 노출하므로
 * 외부 호출 시 대안 경로 확인이 목적.
 */
async function main() {
  const queue = new Queue('verify-cancel', getBullMQOptions());
  const worker = new Worker(
    'verify-cancel',
    async (_job) => {
      // 10초 sleep — 중간에 외부에서 cancel 시도
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        console.warn(`[worker] tick ${i}`);
      }
      return { ok: true };
    },
    getBullMQOptions(),
  );

  await queue.add('test', { runId: 'verify' }, { jobId: 'verify-job-1' });
  await new Promise((r) => setTimeout(r, 2000)); // active 진입 대기

  const fetched = await queue.getJob('verify-job-1');
  if (!fetched) throw new Error('job not found');
  const state = await fetched.getState();
  console.warn('[verify] state before cancel:', state);

  // 시도 A: discard + moveToFailed with empty token
  try {
    await fetched.discard();
    // @ts-expect-error — token 인자 확인용
    await fetched.moveToFailed(new Error('external-cancel'), '0', false);
    console.warn('[verify] external moveToFailed SUCCESS');
  } catch (err) {
    console.warn('[verify] external moveToFailed FAILED:', (err as Error).message);
    // 시도 B: remove
    try {
      await fetched.remove();
      console.warn('[verify] fallback remove SUCCESS');
    } catch (err2) {
      console.warn('[verify] remove FAILED:', (err2 as Error).message);
    }
  }

  await new Promise((r) => setTimeout(r, 12000)); // worker 자연 종료 대기
  await worker.close();
  await queue.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
