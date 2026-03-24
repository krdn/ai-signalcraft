import { describe, it, expect, vi, beforeEach } from 'vitest';

// 모듈 mock 설정 -- runner가 의존하는 외부 모듈들
vi.mock('@ai-signalcraft/ai-gateway', () => ({
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
}));

vi.mock('../src/analysis/data-loader', () => ({
  loadAnalysisInput: vi.fn().mockResolvedValue({
    jobId: 1,
    keyword: '테스트',
    articles: [],
    videos: [],
    comments: [],
    dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
  }),
}));

vi.mock('../src/analysis/persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue({ id: 1 }),
  persistAnalysisReport: vi.fn().mockResolvedValue({ id: 1 }),
}));

describe('analysis/runner', () => {
  it('runAnalysisPipeline 함수가 export된다', async () => {
    const runner = await import('../src/analysis/runner');
    expect(runner.runAnalysisPipeline).toBeDefined();
    expect(typeof runner.runAnalysisPipeline).toBe('function');
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

  it('runModule이 성공 시 completed 상태와 usage를 반환한다', async () => {
    const { runModule } = await import('../src/analysis/runner');
    const { macroViewModule } = await import('../src/analysis/modules/macro-view');
    const mockInput = {
      jobId: 1,
      keyword: '테스트',
      articles: [],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    };

    const result = await runModule(macroViewModule, mockInput);
    expect(result.status).toBe('completed');
    expect(result.module).toBe('macro-view');
    expect(result.usage).toBeDefined();
  });

  it('runModule이 실패 시 failed 상태와 errorMessage를 반환한다', async () => {
    const { analyzeStructured } = await import('@ai-signalcraft/ai-gateway');
    (analyzeStructured as any).mockRejectedValueOnce(new Error('API 호출 실패'));

    const { runModule } = await import('../src/analysis/runner');
    const { macroViewModule } = await import('../src/analysis/modules/macro-view');
    const mockInput = {
      jobId: 1,
      keyword: '테스트',
      articles: [],
      videos: [],
      comments: [],
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
    };

    const result = await runModule(macroViewModule, mockInput);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('API 호출 실패');
  });

  it('runAnalysisPipeline이 모든 모듈 결과를 반환한다', async () => {
    const { runAnalysisPipeline } = await import('../src/analysis/runner');
    const result = await runAnalysisPipeline(1);

    expect(result.results).toBeDefined();
    expect(result.completedModules).toBeDefined();
    expect(result.failedModules).toBeDefined();
    // 8개 모듈 모두 실행됨 (Stage1: 4 + Stage2: 3 + Final: 1)
    expect(Object.keys(result.results)).toHaveLength(8);
  });

  it('runAnalysisPipeline이 report 필드를 포함한 결과를 반환한다', async () => {
    const { runAnalysisPipeline } = await import('../src/analysis/runner');
    const result = await runAnalysisPipeline(1);

    // 리포트 필드 검증
    expect(result.report).toBeDefined();
    expect(result.report.markdownContent).toBeDefined();
    expect(typeof result.report.markdownContent).toBe('string');
    expect(typeof result.report.oneLiner).toBe('string');
    expect(typeof result.report.totalTokens).toBe('number');
    expect(result.report.totalTokens).toBeGreaterThan(0);
  });
});
