/* eslint-disable import-x/order */
/**
 * fallback 보고서 경로(buildResult → saveFallbackReport)에서도 Phase 3 quality metadata + footer가
 * 적용되는지 검증. 정상 보고서 경로(generator.ts)는 report-generator-quality.test.ts가 검증.
 *
 * vi.mock 호이스팅 때문에 import-x/order 규칙을 비활성화 — vi.hoisted/vi.mock 호출이
 * imports 사이에 끼어들어야 하는 vitest 패턴.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { persistMock, progressMock } = vi.hoisted(() => ({
  persistMock: vi.fn().mockResolvedValue({ id: 1 }),
  progressMock: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
}));

vi.mock('@krdn/ai-analysis-kit/gateway', () => ({
  analyzeText: vi.fn(),
  analyzeStructured: vi.fn(),
}));

// generateIntegratedReport mock — buildResult가 try → catch fallback 흐름을 타도록 강제 throw
vi.mock('../src/report/generator', () => ({
  generateIntegratedReport: vi.fn().mockRejectedValue(new Error('LLM 호출 실패')),
}));

vi.mock('../src/pipeline/persist', () => ({
  updateJobProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/analysis/persist-analysis', () => ({
  persistAnalysisReport: persistMock,
}));

vi.mock('../src/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => progressMock(),
        }),
      }),
    }),
  }),
}));
import { buildResult } from '../src/analysis/report-builder';
import type { AnalysisInput, AnalysisModuleResult } from '../src/analysis/types';

const baseInput: AnalysisInput = {
  jobId: 999,
  keyword: '한동훈',
  articles: [],
  videos: [],
  comments: [],
  dateRange: {
    start: new Date('2026-04-19T00:00:00Z'),
    end: new Date('2026-04-26T00:00:00Z'),
  },
  domain: 'political',
};

const completedResult: AnalysisModuleResult = {
  module: 'segmentation',
  status: 'completed',
  result: { ok: true },
};

describe('saveFallbackReport — Phase 3 quality metadata 통합', () => {
  beforeEach(() => {
    persistMock.mockClear();
    progressMock.mockReset();
  });

  it('progress._events에 청크 실패 warn이 있으면 metadata에 modulesPartial/qualityFlags + footer', async () => {
    progressMock.mockResolvedValue([
      {
        progress: {
          _events: [
            {
              ts: '2026-04-26T15:10:00Z',
              level: 'warn',
              msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity on this model. Your quota will reset after 0s.',
            },
          ],
          sampling: {
            articles: { totalSampled: 230 },
            comments: { totalSampled: 401 },
          },
        },
      },
    ]);

    await buildResult(
      { segmentation: completedResult },
      true, // cancelledByUser → fallback 경로 진입
      false,
      baseInput,
    );

    expect(persistMock).toHaveBeenCalledTimes(1);
    const arg = persistMock.mock.calls[0][0];
    expect(arg.metadata.qualityFlags).toBeDefined();
    expect(arg.metadata.qualityFlags.hasRateLimitFailures).toBe(true);
    expect(arg.metadata.qualityFlags.hasPartialModules).toBe(true);
    expect(arg.metadata.modulesPartial).toHaveLength(1);
    expect(arg.metadata.modulesPartial[0].module).toBe('segmentation');
    expect(arg.metadata.warnings).toHaveLength(1);
    // markdown footer 자동 첨부
    expect(arg.markdownContent).toContain('## ⚠️ 분석 경고');
    expect(arg.markdownContent).toContain('segmentation');
  });

  it('progress가 비어 있어도 qualityFlags 키는 포함됨 (모두 false)', async () => {
    progressMock.mockResolvedValue([{ progress: {} }]);

    await buildResult({ segmentation: completedResult }, true, false, baseInput);

    expect(persistMock).toHaveBeenCalledTimes(1);
    const arg = persistMock.mock.calls[0][0];
    expect(arg.metadata.qualityFlags).toEqual({
      hasRateLimitFailures: false,
      hasPartialModules: false,
      samplingShallow: false,
    });
    expect(arg.metadata.modulesPartial).toEqual([]);
    expect(arg.metadata.warnings).toEqual([]);
    // flags 모두 false → footer 미첨부
    expect(arg.markdownContent).not.toContain('⚠️ 분석 경고');
  });

  it('progress 조회 실패 시에도 graceful fallback (qualityFlags 비어 있는 채로)', async () => {
    progressMock.mockRejectedValue(new Error('DB 일시 장애'));

    await buildResult({ segmentation: completedResult }, true, false, baseInput);

    expect(persistMock).toHaveBeenCalledTimes(1);
    const arg = persistMock.mock.calls[0][0];
    expect(arg.metadata.qualityFlags).toBeDefined();
    expect(arg.metadata.qualityFlags.hasPartialModules).toBe(false);
  });
});
