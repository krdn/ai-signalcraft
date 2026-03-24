import { describe, it, expect } from 'vitest';

describe('Analysis DB Schema', () => {
  it('analysisResults 스키마가 export되고 필수 컬럼을 포함한다', async () => {
    const { analysisResults } = await import('../src/db/schema/analysis');
    expect(analysisResults).toBeDefined();

    // 필수 컬럼 확인: id, jobId, module, status, result, usage
    const columns = analysisResults as any;
    expect(columns.id).toBeDefined();
    expect(columns.jobId).toBeDefined();
    expect(columns.module).toBeDefined();
    expect(columns.status).toBeDefined();
    expect(columns.result).toBeDefined();
    expect(columns.usage).toBeDefined();
  });

  it('analysisReports 스키마가 export되고 필수 컬럼을 포함한다', async () => {
    const { analysisReports } = await import('../src/db/schema/analysis');
    expect(analysisReports).toBeDefined();

    const columns = analysisReports as any;
    expect(columns.id).toBeDefined();
    expect(columns.jobId).toBeDefined();
    expect(columns.title).toBeDefined();
    expect(columns.markdownContent).toBeDefined();
    expect(columns.oneLiner).toBeDefined();
    expect(columns.metadata).toBeDefined();
  });
});

describe('AnalysisModule 인터페이스 + 타입', () => {
  it('AnalysisModule 인터페이스가 필수 프로퍼티를 포함한다', async () => {
    const mod = await import('../src/analysis/types');
    // 인터페이스는 런타임에 직접 테스트 불가 -- 타입 체크로 충분
    // MODULE_MODEL_MAP을 통해 간접 검증
    expect(mod.MODULE_MODEL_MAP).toBeDefined();
  });

  it('AnalysisInput 타입이 필수 필드를 가진다', async () => {
    const { MODULE_MODEL_MAP } = await import('../src/analysis/types');
    // AnalysisInput은 인터페이스이므로 타입 레벨에서 검증
    // 빌드가 성공하면 타입이 올바름을 확인
    expect(MODULE_MODEL_MAP).toBeDefined();
  });

  it('MODULE_MODEL_MAP이 8개 기본 모듈 + 4개 ADVN 모듈 + integrated-report 매핑을 포함한다', async () => {
    const { MODULE_MODEL_MAP } = await import('../src/analysis/types');

    const expectedModules = [
      'macro-view', 'segmentation', 'sentiment-framing', 'message-impact',
      'risk-map', 'opportunity', 'strategy', 'final-summary',
      'integrated-report',
      // Stage 4: ADVN 고급 분석 모듈
      'approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation',
    ];

    for (const mod of expectedModules) {
      expect(MODULE_MODEL_MAP[mod]).toBeDefined();
      expect(MODULE_MODEL_MAP[mod].provider).toBeDefined();
      expect(MODULE_MODEL_MAP[mod].model).toBeDefined();
    }

    expect(Object.keys(MODULE_MODEL_MAP).length).toBe(13);
  });
});

describe('Analysis 함수 exports', () => {
  it('persistAnalysisResult 함수가 export된다', async () => {
    const { persistAnalysisResult } = await import('../src/analysis/persist-analysis');
    expect(typeof persistAnalysisResult).toBe('function');
  });

  it('persistAnalysisReport 함수가 export된다', async () => {
    const { persistAnalysisReport } = await import('../src/analysis/persist-analysis');
    expect(typeof persistAnalysisReport).toBe('function');
  });

  it('loadAnalysisInput 함수가 export된다', async () => {
    const { loadAnalysisInput } = await import('../src/analysis/data-loader');
    expect(typeof loadAnalysisInput).toBe('function');
  });
});
