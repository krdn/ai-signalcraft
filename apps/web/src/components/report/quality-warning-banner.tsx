'use client';

import { useState } from 'react';

type ModulePartial = {
  module: string;
  reason: 'rate-limit' | 'parse-error' | 'unknown';
  chunksTotal: number | null;
  chunksFailed: number | null;
};

type QualityWarning = {
  ts: string;
  phase: string | null;
  module: string | null;
  level: 'warn';
  msg: string;
};

type QualityFlags = {
  hasRateLimitFailures: boolean;
  hasPartialModules: boolean;
  samplingShallow: boolean;
};

export type ReportQualityMetadata = {
  modulesPartial?: ModulePartial[];
  warnings?: QualityWarning[];
  qualityFlags?: QualityFlags;
};

export function QualityWarningBanner(props: { metadata: unknown }) {
  const [open, setOpen] = useState(false);

  const meta = (props.metadata ?? {}) as ReportQualityMetadata;
  const flags = meta.qualityFlags;
  if (!flags) return null;
  if (!flags.hasPartialModules && !flags.samplingShallow && !flags.hasRateLimitFailures) {
    return null;
  }

  const partials = meta.modulesPartial ?? [];
  const warnings = meta.warnings ?? [];

  const reasonLabel = (r: ModulePartial['reason']) =>
    r === 'rate-limit' ? 'rate-limit' : r === 'parse-error' ? 'parse-error' : '미분류';

  return (
    <div
      className="mx-4 my-3 md:mx-8 rounded-md border border-yellow-500 bg-yellow-50 p-3 text-yellow-900 print:hidden"
      role="status"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span aria-hidden="true">⚠️ </span>이 분석에는 일부 모듈이 부분 실패했거나 표본이
          얕습니다. 결과 해석 시 주의하세요.
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs underline shrink-0"
        >
          {open ? '닫기' : '상세 보기'}
        </button>
      </div>

      {open && (
        <div className="mt-3 text-sm space-y-3">
          {partials.length > 0 && (
            <div>
              <div className="font-semibold">부분 실패 모듈</div>
              <ul className="list-disc ml-5 mt-1">
                {partials.map((m) => (
                  <li key={m.module}>
                    {m.module} <span className="text-xs">({reasonLabel(m.reason)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flags.samplingShallow && (
            <div>
              <div className="font-semibold">얕은 표본</div>
              <p className="mt-1">
                분석에 사용된 articles 또는 comments가 200건 미만입니다. 결과의 일반성에 주의하세요.
              </p>
            </div>
          )}

          {warnings.length > 0 && (
            <div>
              <div className="font-semibold">경고 로그</div>
              <ul className="list-disc ml-5 mt-1 max-h-40 overflow-y-auto">
                {warnings.map((w, i) => (
                  <li key={i} className="font-mono text-xs">
                    [{w.ts}] {w.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
