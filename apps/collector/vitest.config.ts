import { defineConfig } from 'vitest/config';

// 통합 테스트(*.integration.test.ts)는 실제 Postgres/TimescaleDB/Redis 연결을 요구하므로
// 기본 `test` 스크립트(CI 차단용)에서는 제외하고, `test:integration` / `test:all`에서만 포함.
//
// TEST_MODE:
//   undefined (default) — 단위 테스트만 (통합 제외) — CI/일상 개발
//   "integration"       — 통합 테스트만 (단위 제외) — 수동 검증
//   "all"               — 단위 + 통합 모두 — 풀 회귀
const mode = process.env.TEST_MODE;

const baseInclude = ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'];
const baseExclude = ['**/node_modules/**', '**/dist/**'];

const include = mode === 'integration' ? ['src/**/*.integration.test.ts'] : baseInclude;

const exclude =
  mode === 'all' || mode === 'integration'
    ? baseExclude
    : [...baseExclude, '**/*.integration.test.ts'];

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['dotenv/config'],
    include,
    exclude,
  },
});
