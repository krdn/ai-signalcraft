import { describe, it, expect, vi, beforeEach } from 'vitest';

// 모듈 mock 설정 -- runner가 의존하는 외부 모듈들
vi.mock('@krdn/ai-analysis-kit/gateway', () => ({
  analyzeStructured: vi.fn().mockResolvedValue({
    object: { mockResult: true },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: 'stop',
  }),
  analyzeText: vi.fn().mockResolvedValue({
    text: '# 종합 분석 리포트\n\n리포트 내용',
    usage: { promptTokens: 500, completionTokens: 1000, totalTokens: 1500 },
    finishReason: 'stop',
  }),
  normalizeUsage: (usage: Record<string, unknown> | undefined | null) => {
    if (!usage) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const inputTokens = (usage.promptTokens as number) || (usage.inputTokens as number) || 0;
    const outputTokens = (usage.completionTokens as number) || (usage.outputTokens as number) || 0;
    const totalTokens = (usage.totalTokens as number) || inputTokens + outputTokens;
    return { inputTokens, outputTokens, totalTokens };
  },
}));

vi.mock('../src/analysis/data-loader', () => ({
  loadAnalysisInput: vi.fn().mockResolvedValue({
    input: {
      jobId: 1,
      keyword: '테스트',
      articles: [],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    },
    samplingStats: {
      binCount: 0,
      binIntervalMs: 0,
      articles: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
      comments: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
      videos: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
    },
  }),
  loadAnalysisInputViaCollector: vi.fn().mockResolvedValue({
    input: {
      jobId: 1,
      keyword: '테스트',
      articles: [],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    },
    samplingStats: {
      binCount: 0,
      binIntervalMs: 0,
      articles: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
      comments: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
      videos: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
    },
    fullset: { articles: [], videos: [], comments: [] },
    collectionMeta: {
      sources: [],
      sourceCounts: {},
      window: { start: '', end: '' },
      truncated: false,
    },
  }),
  shouldUseCollectorLoader: vi.fn().mockReturnValue(false),
}));

vi.mock('../src/pipeline/persist-from-collector', () => ({
  persistFromCollectorPayload: vi
    .fn()
    .mockResolvedValue({ articles: 100, videos: 0, comments: 1000 }),
}));

vi.mock('../src/analysis/persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue({ id: 1 }),
  persistAnalysisReport: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('../src/analysis/model-config', () => ({
  getModuleModelConfig: vi.fn().mockResolvedValue({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    baseUrl: undefined,
    apiKey: undefined,
  }),
}));

vi.mock('../src/pipeline/control', () => ({
  isPipelineCancelled: vi.fn().mockResolvedValue(false),
  waitIfPaused: vi.fn().mockResolvedValue(true),
  checkCostLimit: vi.fn().mockResolvedValue({ exceeded: false, currentCost: 0, limit: 100 }),
  getSkippedModules: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/pipeline/persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
  updateJobProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/analysis/concurrency-config', () => ({
  getConcurrencyConfig: vi.fn().mockResolvedValue({
    providerConcurrency: { gemini: 2, anthropic: 2, openai: 2 },
  }),
}));

vi.mock('../src/db', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ options: {} }]),
        }),
        then: vi.fn(),
      }),
    }),
  }),
}));

describe('analysis/runner', () => {
  it('runAnalysisPipeline은 pipeline-orchestrator에서 export된다', async () => {
    // 이전엔 runner.ts에서 re-export했으나 순환 의존(runner ↔ pipeline-orchestrator)
    // 해소를 위해 제거. 사용처는 pipeline-orchestrator에서 직접 import.
    const orchestrator = await import('../src/analysis/pipeline-orchestrator');
    expect(orchestrator.runAnalysisPipeline).toBeDefined();
    expect(typeof orchestrator.runAnalysisPipeline).toBe('function');
  });

  it('runModule 함수가 export된다', async () => {
    const runner = await import('../src/analysis/runner');
    expect(runner.runModule).toBeDefined();
    expect(typeof runner.runModule).toBe('function');
  });

  it('STAGE1_MODULES 배열이 4개 모듈을 포함한다', async () => {
    const runner = await import('../src/analysis/runner');
    expect(runner.STAGE1_MODULES).toHaveLength(4);
    const names = runner.STAGE1_MODULES.map((m: any) => m.name);
    expect(names).toContain('macro-view');
    expect(names).toContain('segmentation');
    expect(names).toContain('sentiment-framing');
    expect(names).toContain('message-impact');
  });

  it('STAGE2_MODULES 배열이 3개 모듈(risk-map, opportunity, strategy)을 포함한다', async () => {
    const runner = await import('../src/analysis/runner');
    expect(runner.STAGE2_MODULES).toHaveLength(3);
    const names = runner.STAGE2_MODULES.map((m: any) => m.name);
    expect(names).toContain('risk-map');
    expect(names).toContain('opportunity');
    expect(names).toContain('strategy');
  });

  // [migration] runModule 본체가 @krdn/ai-analysis-kit으로 이전됨 —
  // gateway mock이 kit 내부 import에 도달하지 못하므로 skip.
  // 이 시나리오는 ai-analysis-kit 저장소의 단위 테스트에서 검증.
  it.skip('runModule이 성공 시 completed 상태와 usage를 반환한다', async () => {
    const { runModule } = await import('../src/analysis/runner');
    const { macroViewModule } = await import('../src/analysis/modules');
    const mockInput = {
      jobId: 1,
      keyword: '테스트',
      articles: [
        {
          title: '테스트 기사',
          content: '내용',
          publisher: '테스트',
          publishedAt: new Date(),
          source: 'naver-news',
        },
      ],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    };

    const result = await runModule(macroViewModule, mockInput);
    expect(result.status).toBe('completed');
    expect(result.module).toBe('macro-view');
    expect(result.usage).toBeDefined();
  });

  it.skip('runModule이 실패 시 failed 상태와 errorMessage를 반환한다', async () => {
    const { analyzeStructured } = await import('@krdn/ai-analysis-kit/gateway');
    (analyzeStructured as any).mockRejectedValueOnce(new Error('API 호출 실패'));

    const { runModule } = await import('../src/analysis/runner');
    const { macroViewModule } = await import('../src/analysis/modules');
    const mockInput = {
      jobId: 1,
      keyword: '테스트',
      articles: [
        {
          title: '테스트 기사',
          content: '내용',
          publisher: '테스트',
          publishedAt: new Date(),
          source: 'naver-news',
        },
      ],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    };

    const result = await runModule(macroViewModule, mockInput);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('API 호출 실패');
  });

  // 통합 테스트 — pipeline-orchestrator가 다수의 DB 쿼리를 수행하므로 DB 연결 필요
  it('useCollectorLoader=true이면 persistFromCollectorPayload를 호출한다', async () => {
    const { loadAnalysisInputViaCollector } = await import('../src/analysis/data-loader');
    const { persistFromCollectorPayload } = await import('../src/pipeline/persist-from-collector');
    const { updateJobProgress } = await import('../src/pipeline/persist');

    // fullset이 포함된 CollectorAnalysisResult 반환
    const mockFullset = {
      articles: [{ source: 'naver-news', sourceId: 'a1', url: 'u', title: 't' } as never],
      videos: [],
      comments: [],
    };
    (loadAnalysisInputViaCollector as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      input: {
        jobId: 1,
        keyword: '테스트',
        articles: [],
        videos: [],
        comments: [],
        dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
      },
      samplingStats: {
        binCount: 0,
        binIntervalMs: 0,
        articles: {
          totalInput: 0,
          totalSampled: 0,
          binsUsed: 0,
          nullPoolSize: 0,
          nullPoolSampled: 0,
          perBin: [],
        },
        comments: {
          totalInput: 0,
          totalSampled: 0,
          binsUsed: 0,
          nullPoolSize: 0,
          nullPoolSampled: 0,
          perBin: [],
        },
        videos: {
          totalInput: 0,
          totalSampled: 0,
          binsUsed: 0,
          nullPoolSize: 0,
          nullPoolSampled: 0,
          perBin: [],
        },
      },
      fullset: mockFullset,
      collectionMeta: {
        sources: [],
        sourceCounts: {},
        window: { start: '', end: '' },
        truncated: false,
      },
    });

    const { runAnalysisPipeline } = await import('../src/analysis/pipeline-orchestrator');
    await runAnalysisPipeline(1, { useCollectorLoader: true }).catch(() => {
      /* 분석 모듈 오류 무시 */
    });

    expect(persistFromCollectorPayload).toHaveBeenCalledWith(1, mockFullset);
    expect(updateJobProgress).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        persist: expect.objectContaining({ status: 'running', source: 'collector' }),
      }),
    );
  });

  it('일반 경로(useCollectorLoader=false)는 persistFromCollectorPayload를 호출하지 않는다', async () => {
    const { persistFromCollectorPayload } = await import('../src/pipeline/persist-from-collector');
    (persistFromCollectorPayload as ReturnType<typeof vi.fn>).mockClear();

    const { runAnalysisPipeline } = await import('../src/analysis/pipeline-orchestrator');
    await runAnalysisPipeline(1, { useCollectorLoader: false }).catch(() => {
      /* 분석 모듈 오류 무시 */
    });

    expect(persistFromCollectorPayload).not.toHaveBeenCalled();
  });

  it.skipIf(!process.env.DATABASE_URL)(
    'runAnalysisPipeline이 모든 모듈 결과를 반환한다',
    async () => {
      const { runAnalysisPipeline } = await import('../src/analysis/runner');
      const result = await runAnalysisPipeline(1);

      expect(result.results).toBeDefined();
      expect(result.completedModules).toBeDefined();
      expect(result.failedModules).toBeDefined();
      // 8개 모듈 모두 실행됨 (Stage1: 4 + Stage2: 3 + Final: 1)
      expect(Object.keys(result.results)).toHaveLength(8);
    },
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'runAnalysisPipeline이 report 필드를 포함한 결과를 반환한다',
    async () => {
      const { runAnalysisPipeline } = await import('../src/analysis/runner');
      const result = await runAnalysisPipeline(1);

      // 리포트 필드 검증
      expect(result.report).toBeDefined();
      expect(result.report.markdownContent).toBeDefined();
      expect(typeof result.report.markdownContent).toBe('string');
      expect(typeof result.report.oneLiner).toBe('string');
      expect(typeof result.report.totalTokens).toBe('number');
      expect(result.report.totalTokens).toBeGreaterThan(0);
    },
  );
});
