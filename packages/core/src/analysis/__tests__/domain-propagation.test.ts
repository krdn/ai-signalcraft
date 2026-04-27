/**
 * 회귀 테스트 — domain이 분석 모듈 시스템 프롬프트에 전달되는지 검증.
 *
 * 배경: kit v2.0.0이 도메인 무지로 재설계되면서 buildSystemPrompt를 인자 없이 호출.
 * 본 프로젝트는 모듈 시그니처에 domain?을 추가했으나, 두 호출 경로(map-reduce, kit runModule)
 * 모두에서 인자가 누락되어 모든 분석이 'political' 폴백으로 수행되던 버그가 있었다.
 *
 * 본 테스트는 가짜 모듈을 만들어 buildSystemPrompt 호출 인자를 기록하고,
 * 두 경로 모두 input.domain을 전달하는지 검증한다.
 */
import { describe, it, expect, vi } from 'vitest';
import type { z } from 'zod';
import { z as zod } from 'zod';
import type { AnalysisModule, AnalysisInput } from '../types';
import type { AnalysisDomain } from '../domain';

vi.mock('../../db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
  })),
}));

vi.mock('../persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue(null),
}));

vi.mock('../module-cache', () => ({
  hashAnalysisInput: vi.fn(() => 'hash'),
  getCachedModuleResult: vi.fn().mockResolvedValue(null),
  setCachedModuleResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../pipeline/control', () => ({
  isPipelineCancelled: vi.fn().mockResolvedValue(false),
  waitIfPaused: vi.fn().mockResolvedValue(true),
  checkCostLimit: vi.fn().mockResolvedValue({ exceeded: false, currentCost: 0, limit: 100 }),
}));

vi.mock('../../pipeline/persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../model-config', () => ({
  getModuleModelConfig: vi.fn().mockResolvedValue({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  }),
  getModuleModelConfigForPreset: vi.fn(),
}));

vi.mock('../../config/concurrency', () => ({
  getConcurrencyConfig: vi.fn().mockResolvedValue({
    providerConcurrency: { anthropic: 2, gemini: 4, openai: 2 },
  }),
}));

// kit의 analyzeStructured는 실제 LLM 호출 — 테스트에서는 가짜 응답
vi.mock('@krdn/ai-analysis-kit/gateway', () => ({
  analyzeStructured: vi.fn().mockResolvedValue({
    object: { stub: 'result' },
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  }),
}));

// AIGatewayOptions 타입 import 위해 별도 mock — 게이트웨이 모듈 전체
vi.mock('@krdn/ai-analysis-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@krdn/ai-analysis-kit')>();
  return {
    ...actual,
    runModule: vi.fn(async (mod: any, input: any) => {
      // kit 동작 모사: buildSystemPrompt를 인자 없이 호출 (v2.0.0 의도된 시그니처)
      const systemPrompt = mod.buildSystemPrompt();
      const prompt = mod.buildPromptWithContext
        ? mod.buildPromptWithContext(input, {})
        : mod.buildPrompt(input);
      return {
        module: mod.name,
        status: 'completed',
        result: { systemPrompt, prompt },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
        },
      };
    }),
  };
});

// 가짜 모듈 — buildSystemPrompt/buildPromptWithContext 호출 인자를 기록
function makeFakeModule(name = 'macro-view'): {
  module: AnalysisModule<{ stub: string }>;
  systemCalls: Array<AnalysisDomain | undefined>;
  contextCalls: Array<AnalysisDomain | undefined>;
} {
  const systemCalls: Array<AnalysisDomain | undefined> = [];
  const contextCalls: Array<AnalysisDomain | undefined> = [];
  const schema = zod.object({ stub: zod.string() }) as unknown as z.ZodType<
    { stub: string },
    z.ZodTypeDef,
    unknown
  >;
  const module: AnalysisModule<{ stub: string }> = {
    name,
    displayName: 'fake',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    schema,
    buildPrompt: () => 'prompt',
    buildSystemPrompt: (domain) => {
      systemCalls.push(domain);
      return `system[${domain ?? 'undefined'}]`;
    },
    buildPromptWithContext: (_data, _prior, domain) => {
      contextCalls.push(domain);
      return `context[${domain ?? 'undefined'}]`;
    },
  };
  return { module, systemCalls, contextCalls };
}

function makeInput(domain: AnalysisDomain | undefined): AnalysisInput {
  return {
    jobId: 999,
    keyword: 'test',
    articles: [],
    videos: [],
    comments: [],
    dateRange: { start: new Date('2026-04-01'), end: new Date('2026-04-07') },
    domain,
  };
}

describe('domain propagation — runModule (kit 경로)', () => {
  it('input.domain을 buildSystemPrompt에 전달한다', async () => {
    const { runModule } = await import('../runner');
    const { module, systemCalls } = makeFakeModule();
    await runModule(module, makeInput('fandom'));
    expect(systemCalls).toEqual(['fandom']);
  });

  it('input.domain을 buildPromptWithContext의 3번째 인자로 전달한다', async () => {
    const { runModule } = await import('../runner');
    const { module, contextCalls } = makeFakeModule();
    await runModule(module, makeInput('finance'), { 'macro-view': { dummy: true } });
    expect(contextCalls).toEqual(['finance']);
  });

  it('input.domain이 undefined면 그대로 undefined를 전달한다 (모듈에서 폴백 처리)', async () => {
    const { runModule } = await import('../runner');
    const { module, systemCalls } = makeFakeModule();
    await runModule(module, makeInput(undefined));
    expect(systemCalls).toEqual([undefined]);
  });
});

describe('domain propagation — map-reduce 직접 경로', () => {
  // map-reduce는 청크 2개 이상일 때만 활성화. 청크 1개면 runModule로 위임 → 위 테스트가 커버.
  // chunkAnalysisInput은 입력 크기로 분기하는데, 작은 입력으로는 청크 분기를 강제할 수 없으므로
  // map-reduce 내부의 buildSystemPrompt 호출을 직접 점검하는 단위 검증으로 대체한다.
  it('map-reduce 모듈 호출에서 buildSystemPrompt에 input.domain이 전달된다 (소스 검증)', async () => {
    // map-reduce.ts 소스를 직접 읽어 buildSystemPrompt() 호출이 input.domain을 인자로 갖는지 확인.
    // 이로써 향후 의도치 않은 회귀(인자 누락) 시 즉시 실패한다.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(path.resolve(__dirname, '..', 'map-reduce.ts'), 'utf-8');
    const matches = src.match(/module\.buildSystemPrompt\(([^)]*)\)/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m).toContain('input.domain');
    }
  });
});
