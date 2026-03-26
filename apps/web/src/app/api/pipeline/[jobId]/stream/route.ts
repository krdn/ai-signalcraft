import { getPipelineStatus } from '@/server/pipeline-status';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (isNaN(jobId)) {
    return new Response('Invalid jobId', { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastHash = '';

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // 컨트롤러가 이미 닫힌 경우 무시
          closed = true;
        }
      };

      // 즉시 첫 데이터 전송
      try {
        const initial = await getPipelineStatus(jobId);
        if (!initial) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'NOT_FOUND' })}\n\n`));
          controller.close();
          return;
        }
        lastHash = JSON.stringify(initial.progress) + initial.status + initial.analysisModuleCount.completed;
        send(initial);
      } catch {
        controller.close();
        return;
      }

      // 1초 간격으로 DB 폴링 → 변경 시에만 push
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const status = await getPipelineStatus(jobId);
          if (!status) {
            clearInterval(interval);
            if (!closed) { closed = true; controller.close(); }
            return;
          }

          const hash = JSON.stringify(status.progress) + status.status + status.analysisModuleCount.completed;

          if (hash !== lastHash) {
            lastHash = hash;
            send(status);
          }

          // 완료/실패/취소 시 스트림 종료
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'partial_failure' || status.status === 'cancelled') {
            // 분석이 아직 진행 중이면 종료하지 않음
            const analysisRunning = status.analysisModulesDetailed.some(
              (m: { status: string }) => m.status === 'running' || m.status === 'pending',
            );
            if (!analysisRunning && (status.hasReport || status.status === 'failed')) {
              clearInterval(interval);
              // 최종 상태 한번 더 전송
              send(status);
              setTimeout(() => { if (!closed) { closed = true; controller.close(); } }, 500);
            }
          }
        } catch {
          clearInterval(interval);
          if (!closed) { closed = true; controller.close(); }
        }
      }, 1000);

      // 클라이언트 연결 끊김 감지
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        closed = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
