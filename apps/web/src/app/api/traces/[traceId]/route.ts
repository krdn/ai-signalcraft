/**
 * Trace 조회 API
 * GET /api/traces/<traceId>
 *
 * 응답 형식:
 *   text/plain (기본): formatTraceTree 사람 읽기 좋은 트리
 *   application/json (Accept 헤더): raw spans 배열
 */
import { getTrace, formatTraceTree } from '@ai-signalcraft/core/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ traceId: string }> }) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const provided = req.headers.get('x-metrics-token');
    if (provided !== token) {
      return new Response('unauthorized', { status: 401 });
    }
  }

  const { traceId } = await params;
  const spans = await getTrace(traceId);
  if (!spans) {
    return new Response('trace not found', { status: 404 });
  }

  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return new Response(JSON.stringify({ traceId, spans }, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const tree = formatTraceTree(spans);
  return new Response(tree, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
