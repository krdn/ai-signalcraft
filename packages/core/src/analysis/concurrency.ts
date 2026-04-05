// 프로바이더별 동시성 제어 — 모듈 실행 시 rate limit 방지
import type { AnalysisModule, AnalysisModuleResult } from './types';
import { getModuleModelConfig } from './model-config';

/**
 * 프로바이더별로 모듈을 그룹화하여 병렬 실행
 * 다른 프로바이더 그룹은 동시에, 같은 프로바이더 내에서는 동시성 제한 적용
 */
export async function runWithProviderGrouping(
  modules: AnalysisModule[],
  fn: (m: AnalysisModule) => Promise<AnalysisModuleResult>,
  providerConcurrency: Record<string, number>,
): Promise<PromiseSettledResult<AnalysisModuleResult>[]> {
  if (modules.length <= 1) {
    return Promise.allSettled(modules.map(fn));
  }

  const configs = await Promise.all(modules.map((m) => getModuleModelConfig(m.name)));
  const groups = new Map<string, AnalysisModule[]>();
  for (let i = 0; i < modules.length; i++) {
    const provider = configs[i].provider;
    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider)!.push(modules[i]);
  }

  console.log(
    `[pipeline] 프로바이더 그룹핑: ${[...groups.entries()]
      .map(([p, ms]) => `${p}=[${ms.map((m) => m.name).join(', ')}]`)
      .join(', ')}`,
  );

  const groupPromises = [...groups.entries()].map(async ([provider, groupModules]) => {
    const concurrency = providerConcurrency[provider] ?? 2;
    return runWithConcurrency(groupModules, fn, concurrency);
  });

  const groupResults = await Promise.allSettled(groupPromises);

  const allResults: PromiseSettledResult<AnalysisModuleResult>[] = [];
  for (const gr of groupResults) {
    if (gr.status === 'fulfilled') {
      allResults.push(...gr.value);
    }
  }
  return allResults;
}

/** 동시성 제한 병렬 실행 (rate limit 방지) */
export async function runWithConcurrency(
  modules: AnalysisModule[],
  fn: (m: AnalysisModule) => Promise<AnalysisModuleResult>,
  concurrency: number = 2,
): Promise<PromiseSettledResult<AnalysisModuleResult>[]> {
  if (concurrency <= 1) {
    const results: PromiseSettledResult<AnalysisModuleResult>[] = [];
    for (const m of modules) {
      const r = await Promise.allSettled([fn(m)]);
      results.push(...r);
    }
    return results;
  }
  const results: PromiseSettledResult<AnalysisModuleResult>[] = [];
  for (let i = 0; i < modules.length; i += concurrency) {
    const batch = modules.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
