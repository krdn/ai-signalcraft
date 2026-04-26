// analysis_reports.metadata에 부분 실패/경고 정보를 채우는 빌더.
// 보고서 markdown에 footer를 append하는 헬퍼도 함께.
//
// 출처:
//   - collection_jobs.progress._events (level === 'warn')
//   - collection_jobs.progress.sampling.{articles,comments}.totalSampled
//
// schema 변경 없음 — analysis_reports.metadata는 jsonb.

const SAMPLING_SHALLOW_THRESHOLD = 200;
const CHUNK_FAILURE_RE = /^([\w-]+) 청크 분석 실패.*Last error: (.+?)\.?$/;

export type ModulePartial = {
  module: string;
  reason: 'rate-limit' | 'parse-error' | 'unknown';
  chunksTotal: number | null;
  chunksFailed: number | null;
};

export type QualityWarning = {
  ts: string;
  phase: string | null;
  module: string | null;
  level: 'warn';
  msg: string;
};

export type QualityFlags = {
  hasRateLimitFailures: boolean;
  hasPartialModules: boolean;
  samplingShallow: boolean;
};

export type QualityMetadata = {
  modulesPartial: ModulePartial[];
  warnings: QualityWarning[];
  qualityFlags: QualityFlags;
};

type ProgressEvent = { ts: string; level: string; msg: string };

export function buildQualityMetadata(
  progress: Record<string, unknown> | null | undefined,
): QualityMetadata {
  const events = (progress?._events as ProgressEvent[] | undefined) ?? [];
  const warns = events.filter((e) => e.level === 'warn');

  const modulesPartial: ModulePartial[] = [];
  const seen = new Set<string>();
  for (const w of warns) {
    const m = w.msg.match(CHUNK_FAILURE_RE);
    if (!m) continue;
    const [, mod, lastErr] = m;
    if (seen.has(mod)) continue;
    seen.add(mod);
    const reason: ModulePartial['reason'] = /capacity|exhausted|quota/i.test(lastErr)
      ? 'rate-limit'
      : /parse|json/i.test(lastErr)
        ? 'parse-error'
        : 'unknown';
    modulesPartial.push({ module: mod, reason, chunksTotal: null, chunksFailed: null });
  }

  const warnings: QualityWarning[] = warns.map((w) => {
    const m = w.msg.match(CHUNK_FAILURE_RE);
    return {
      ts: w.ts,
      phase: m ? 'analysis' : null,
      module: m?.[1] ?? null,
      level: 'warn',
      msg: w.msg,
    };
  });

  const sampling = progress?.sampling as
    | {
        articles?: { totalSampled?: number };
        comments?: { totalSampled?: number };
      }
    | undefined;
  const articlesShallow =
    (sampling?.articles?.totalSampled ?? Infinity) < SAMPLING_SHALLOW_THRESHOLD;
  const commentsShallow =
    (sampling?.comments?.totalSampled ?? Infinity) < SAMPLING_SHALLOW_THRESHOLD;

  const qualityFlags: QualityFlags = {
    hasRateLimitFailures: modulesPartial.some((m) => m.reason === 'rate-limit'),
    hasPartialModules: modulesPartial.length > 0,
    samplingShallow: articlesShallow || commentsShallow,
  };

  return { modulesPartial, warnings, qualityFlags };
}

export function appendQualityFooterToMarkdown(markdown: string, meta: QualityMetadata): string {
  const f = meta.qualityFlags;
  if (!f.hasPartialModules && !f.samplingShallow && !f.hasRateLimitFailures) {
    return markdown;
  }

  const lines: string[] = [
    '',
    '---',
    '',
    '## ⚠️ 분석 경고',
    '',
    '이 보고서에는 다음 경고가 포함됩니다:',
    '',
  ];
  if (meta.modulesPartial.length > 0) {
    const mods = meta.modulesPartial.map((m) => m.module).join(', ');
    const reason = meta.modulesPartial.every((m) => m.reason === 'rate-limit')
      ? 'rate-limit으로 일부 청크 분석 누락'
      : '일부 청크 분석 실패';
    lines.push(`- **부분 실패 모듈**: ${mods} (${reason})`);
  }
  if (f.samplingShallow) {
    lines.push(
      `- **얕은 표본**: 분석 입력 중 articles 또는 comments 표본이 ${SAMPLING_SHALLOW_THRESHOLD}건 미만입니다.`,
    );
  }
  lines.push(
    '',
    '자세한 경고 로그는 모니터 페이지의 "분석 경고" 또는 잡 상세의 progress._events를 확인하세요.',
  );
  return markdown.trimEnd() + '\n' + lines.join('\n') + '\n';
}
