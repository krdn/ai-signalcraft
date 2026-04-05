import { sql, eq, and, gte, lte, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { analysisResults } from '../db/schema/analysis';
import { collectionJobs } from '../db/schema/collections';

// 프로바이더/모델별 단가 (USD per 1M tokens)
// 입력/출력 각각 별도 단가
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-20250414': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  // Google
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

// 기본 단가 (알 수 없는 모델)
const DEFAULT_PRICING = { input: 1.0, output: 3.0 };

/** 토큰 수와 모델로 비용(USD) 계산 */
export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/** 기간별 총 비용 요약 */
export async function getUsageSummary(startDate: Date, endDate: Date) {
  const db = getDb();
  const rows = await db
    .select({
      provider: sql<string>`(${analysisResults.usage}->>'provider')`.as('provider'),
      model: sql<string>`(${analysisResults.usage}->>'model')`.as('model'),
      totalInputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'inputTokens')::int), 0)`.as(
          'total_input',
        ),
      totalOutputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'outputTokens')::int), 0)`.as(
          'total_output',
        ),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(analysisResults)
    .where(
      and(
        isNotNull(analysisResults.usage),
        gte(analysisResults.createdAt, startDate),
        lte(analysisResults.createdAt, endDate),
      ),
    )
    .groupBy(sql`${analysisResults.usage}->>'provider'`, sql`${analysisResults.usage}->>'model'`);

  return rows.map((row) => ({
    provider: row.provider,
    model: row.model,
    inputTokens: Number(row.totalInputTokens),
    outputTokens: Number(row.totalOutputTokens),
    totalTokens: Number(row.totalInputTokens) + Number(row.totalOutputTokens),
    estimatedCostUsd: calculateCost(
      Number(row.totalInputTokens),
      Number(row.totalOutputTokens),
      row.model,
    ),
    analysisCount: Number(row.count),
  }));
}

/** 팀별 비용 집계 */
export async function getUsageByTeam(startDate: Date, endDate: Date) {
  const db = getDb();
  const rows = await db
    .select({
      teamId: collectionJobs.teamId,
      totalInputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'inputTokens')::int), 0)`.as(
          'total_input',
        ),
      totalOutputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'outputTokens')::int), 0)`.as(
          'total_output',
        ),
      jobCount: sql<number>`COUNT(DISTINCT ${collectionJobs.id})`.as('job_count'),
    })
    .from(analysisResults)
    .innerJoin(collectionJobs, eq(analysisResults.jobId, collectionJobs.id))
    .where(
      and(
        isNotNull(analysisResults.usage),
        gte(analysisResults.createdAt, startDate),
        lte(analysisResults.createdAt, endDate),
      ),
    )
    .groupBy(collectionJobs.teamId);

  return rows.map((row) => ({
    teamId: row.teamId,
    inputTokens: Number(row.totalInputTokens),
    outputTokens: Number(row.totalOutputTokens),
    estimatedCostUsd: calculateCost(
      Number(row.totalInputTokens),
      Number(row.totalOutputTokens),
      '', // 팀 집계는 기본 단가 사용
    ),
    jobCount: Number(row.jobCount),
  }));
}

/** 모듈별 비용 분포 */
export async function getUsageByModule(startDate: Date, endDate: Date) {
  const db = getDb();
  const rows = await db
    .select({
      module: analysisResults.module,
      model: sql<string>`(${analysisResults.usage}->>'model')`.as('model'),
      totalInputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'inputTokens')::int), 0)`.as(
          'total_input',
        ),
      totalOutputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'outputTokens')::int), 0)`.as(
          'total_output',
        ),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(analysisResults)
    .where(
      and(
        isNotNull(analysisResults.usage),
        gte(analysisResults.createdAt, startDate),
        lte(analysisResults.createdAt, endDate),
      ),
    )
    .groupBy(analysisResults.module, sql`${analysisResults.usage}->>'model'`);

  return rows.map((row) => ({
    module: row.module,
    model: row.model,
    inputTokens: Number(row.totalInputTokens),
    outputTokens: Number(row.totalOutputTokens),
    estimatedCostUsd: calculateCost(
      Number(row.totalInputTokens),
      Number(row.totalOutputTokens),
      row.model,
    ),
    analysisCount: Number(row.count),
  }));
}

/** 일별 비용 추이 (Recharts 데이터 형태) */
export async function getUsageTrend(startDate: Date, endDate: Date) {
  const db = getDb();
  const rows = await db
    .select({
      date: sql<string>`DATE(${analysisResults.createdAt})`.as('date'),
      totalInputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'inputTokens')::int), 0)`.as(
          'total_input',
        ),
      totalOutputTokens:
        sql<number>`COALESCE(SUM((${analysisResults.usage}->>'outputTokens')::int), 0)`.as(
          'total_output',
        ),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(analysisResults)
    .where(
      and(
        isNotNull(analysisResults.usage),
        gte(analysisResults.createdAt, startDate),
        lte(analysisResults.createdAt, endDate),
      ),
    )
    .groupBy(sql`DATE(${analysisResults.createdAt})`)
    .orderBy(sql`DATE(${analysisResults.createdAt})`);

  return rows.map((row) => ({
    date: row.date,
    inputTokens: Number(row.totalInputTokens),
    outputTokens: Number(row.totalOutputTokens),
    estimatedCostUsd: calculateCost(
      Number(row.totalInputTokens),
      Number(row.totalOutputTokens),
      '', // 일별 집계는 기본 단가
    ),
    analysisCount: Number(row.count),
  }));
}
