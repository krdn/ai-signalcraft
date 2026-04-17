/**
 * Prometheus 메트릭 export 엔드포인트
 * GET /api/metrics
 *
 * 외부 Prometheus 서버가 scrape할 수 있도록 표준 텍스트 포맷으로 응답.
 * 인증: X-Metrics-Token 헤더 (환경변수 METRICS_TOKEN과 매칭 시 허용)
 *       토큰 미설정 시 로컬 접근만 허용 (선택적 보안)
 */
import { exportPrometheusMetrics } from '@ai-signalcraft/core/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TRACKED_STAGES = [
  'normalization',
  'token-optimization',
  'module:macro-view',
  'module:segmentation',
  'module:sentiment-framing',
  'module:message-impact',
  'module:risk-map',
  'module:opportunity',
  'module:strategy',
  'module:final-summary',
  'module:approval-rating',
  'module:frame-war',
  'module:crisis-scenario',
  'module:win-simulation',
];

export async function GET(req: Request) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const provided = req.headers.get('x-metrics-token');
    if (provided !== token) {
      return new Response('unauthorized', { status: 401 });
    }
  }

  try {
    const text = await exportPrometheusMetrics(TRACKED_STAGES);
    return new Response(text, {
      status: 200,
      headers: {
        'content-type': 'text/plain; version=0.0.4; charset=utf-8',
        'cache-control': 'no-cache',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(`# error: ${msg}\n`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
