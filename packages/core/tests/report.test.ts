import { describe, it, expect, vi, beforeEach } from 'vitest';

// AI Gateway mock -- analyzeText 함수
vi.mock('@ai-signalcraft/ai-gateway', () => ({
  analyzeText: vi.fn().mockResolvedValue({
    text: '# 종합 분석 리포트: 테스트\n\n리포트 내용입니다.',
    usage: { promptTokens: 500, completionTokens: 1000, totalTokens: 1500 },
    finishReason: 'stop',
  }),
  analyzeStructured: vi.fn().mockResolvedValue({
    object: { mockResult: true },
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: 'stop',
  }),
}));

// Playwright mock -- 실제 브라우저 실행 방지
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setContent: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// DB persist mock
vi.mock('../src/analysis/persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue({ id: 1 }),
  persistAnalysisReport: vi.fn().mockResolvedValue({ id: 1 }),
}));

describe('report/generator', () => {
  it('generateIntegratedReport 함수가 export된다', async () => {
    const mod = await import('../src/report/generator');
    expect(mod.generateIntegratedReport).toBeDefined();
    expect(typeof mod.generateIntegratedReport).toBe('function');
  });

  it('generateIntegratedReport가 jobId, keyword, results 파라미터를 받는다', async () => {
    const { generateIntegratedReport } = await import('../src/report/generator');

    const result = await generateIntegratedReport({
      jobId: 1,
      keyword: '테스트',
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
      results: {
        'macro-view': {
          module: 'macro-view',
          status: 'completed',
          result: { overview: '테스트 결과' },
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        },
        'final-summary': {
          module: 'final-summary',
          status: 'completed',
          result: { oneLiner: '테스트 한 줄 요약' },
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          },
        },
      },
      completedModules: ['macro-view', 'final-summary'],
      failedModules: [],
    });

    expect(result.markdownContent).toBeDefined();
    expect(typeof result.markdownContent).toBe('string');
    expect(result.oneLiner).toBe('테스트 한 줄 요약');
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('부분 실패 시 가용한 모듈 결과만으로 리포트가 생성된다', async () => {
    const { generateIntegratedReport } = await import('../src/report/generator');

    const result = await generateIntegratedReport({
      jobId: 2,
      keyword: '부분실패',
      dateRange: { start: new Date('2026-03-01'), end: new Date('2026-03-20') },
      results: {
        'macro-view': {
          module: 'macro-view',
          status: 'completed',
          result: { overview: '테스트' },
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        },
        segmentation: {
          module: 'segmentation',
          status: 'failed',
          errorMessage: 'API 실패',
        },
      },
      completedModules: ['macro-view'],
      failedModules: ['segmentation'],
    });

    // 리포트가 생성됨
    expect(result.markdownContent).toBeDefined();
  });
});

describe('report/pdf-exporter', () => {
  it('exportToPdf 함수가 export된다', async () => {
    const mod = await import('../src/report/pdf-exporter');
    expect(mod.exportToPdf).toBeDefined();
    expect(typeof mod.exportToPdf).toBe('function');
  });
});

describe('report/persist-analysis', () => {
  it('persistAnalysisReport가 export되고 함수 타입이다', async () => {
    const { persistAnalysisReport } = await import('../src/analysis/persist-analysis');
    expect(typeof persistAnalysisReport).toBe('function');
  });

  it('analysisReports 스키마에 jobId unique index가 정의되어 있다', async () => {
    const { analysisReports } = await import('../src/db/schema/analysis');
    // 테이블 정의와 jobId 컬럼 존재 확인
    expect(analysisReports.jobId).toBeDefined();
    // Drizzle 테이블의 config extraConfig가 정의되어 있는지 확인
    const { getTableConfig } = await import('drizzle-orm/pg-core');
    const config = getTableConfig(analysisReports);
    // uniqueConstraints 또는 indexes에 job_id 관련 항목 존재
    const hasJobIdIndex = config.indexes.some(
      (idx) => idx.config.name === 'analysis_reports_job_id_idx',
    );
    expect(hasJobIdIndex).toBe(true);
  });
});

describe('report/index barrel', () => {
  it('report barrel이 generator와 pdf-exporter를 re-export한다', async () => {
    const mod = await import('../src/report/index');
    expect(mod.generateIntegratedReport).toBeDefined();
    expect(mod.exportToPdf).toBeDefined();
  });
});
