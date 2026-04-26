import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateIntegratedReport } from '../src/report/generator';
import { persistAnalysisReport } from '../src/analysis/persist-analysis';

// AI Gateway mock
vi.mock('@krdn/ai-analysis-kit/gateway', () => ({
  analyzeText: vi.fn().mockResolvedValue({
    text: '# 분석 보고서\n\n본문 내용',
    usage: { totalTokens: 1000 },
  }),
}));

// persistAnalysisReport mock
vi.mock('../src/analysis/persist-analysis', () => ({
  persistAnalysisReport: vi.fn().mockResolvedValue({ id: 999 }),
  persistAnalysisResult: vi.fn().mockResolvedValue({ id: 1 }),
}));

// model-config mock
vi.mock('../src/analysis/model-config', () => ({
  getModuleModelConfig: vi.fn().mockResolvedValue({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    baseUrl: '',
    apiKey: 'test-key',
  }),
}));

// DB mock — getDb().select().from().where().limit() 체인
vi.mock('../src/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                progress: {
                  _events: [
                    {
                      ts: '2026-04-26T04:44:36Z',
                      level: 'warn',
                      msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity.',
                    },
                  ],
                  sampling: {
                    articles: { totalSampled: 130 },
                    comments: { totalSampled: 200 },
                  },
                },
              },
            ]),
        }),
      }),
    }),
  }),
}));

// domain config mock
vi.mock('../src/analysis/domain', () => ({
  getDomainConfig: () => ({
    displayName: '정치 여론',
    reportSystemPrompt: '정치 여론 분석 시스템 프롬프트',
    reportSectionTemplate: '\n1. 핵심 요약\n2. 세부 분석\n3. 전략 제언',
    stage4: { parallel: [], sequential: [] },
  }),
  getSupportedDomains: () => ['political'],
}));

// generateIntegratedReport — quality metadata 통합 smoke test
// 외부 LLM / DB 의존성을 모두 mock하여 footer 삽입 + metadata 필드 전달 여부만 검증.
describe('generateIntegratedReport — quality metadata 통합', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('progress._events에 rate-limit warn → markdown footer + metadata.qualityFlags 포함', async () => {
    const result = await generateIntegratedReport({
      jobId: 271,
      keyword: '한동훈',
      dateRange: { start: new Date('2026-04-19'), end: new Date('2026-04-26') },
      results: {
        'final-summary': {
          module: 'final-summary',
          status: 'completed',
          result: { oneLiner: '한 줄 요약 테스트' },
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
          },
        },
      },
      completedModules: ['final-summary'],
      failedModules: [],
    } as never);

    // 반환된 markdown에 footer가 포함되어야 함
    expect(result.markdownContent).toContain('## ⚠️ 분석 경고');
    expect(result.markdownContent).toContain('segmentation');
    expect(result.markdownContent).toContain('rate-limit으로 일부 청크 분석 누락');
    // 얕은 표본도 포함 (articles 130 < 200)
    expect(result.markdownContent).toContain('얕은 표본');

    // persistAnalysisReport에 신규 metadata 필드가 전달되어야 함
    const saveCall = (persistAnalysisReport as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(saveCall.markdownContent).toContain('## ⚠️ 분석 경고');
    expect(saveCall.metadata.qualityFlags.hasPartialModules).toBe(true);
    expect(saveCall.metadata.qualityFlags.hasRateLimitFailures).toBe(true);
    expect(saveCall.metadata.qualityFlags.samplingShallow).toBe(true);
    expect(saveCall.metadata.modulesPartial).toHaveLength(1);
    expect(saveCall.metadata.modulesPartial[0].module).toBe('segmentation');
    expect(saveCall.metadata.warnings).toHaveLength(1);
  });

  it('보고서 생성 후 markdownContent가 string으로 반환됨', async () => {
    const result = await generateIntegratedReport({
      jobId: 271,
      keyword: '기본케이스',
      dateRange: { start: new Date('2026-04-01'), end: new Date('2026-04-26') },
      results: {
        'final-summary': {
          module: 'final-summary',
          status: 'completed',
          result: { oneLiner: '요약' },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
          },
        },
      },
      completedModules: ['final-summary'],
      failedModules: [],
    } as never);

    expect(result.markdownContent).toBeDefined();
    expect(typeof result.markdownContent).toBe('string');
  });
});
