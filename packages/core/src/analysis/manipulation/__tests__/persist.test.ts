import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { persistRun } from '../persist';
import type { RunOutput } from '../runner';

describe('persistRun', () => {
  it('runs/signals/evidence 모두 INSERT 호출', async () => {
    const inserts: { table: string; values: unknown }[] = [];
    // Drizzle mock — runtime 테이블 이름은 Symbol.for('drizzle:Name')에 있으므로
    // getTableName()으로 추출. persist.ts는 두 가지 chain shape을 사용:
    //   1) runs:    insert(t).values(v).returning(...).execute() → [{id}]
    //   2) signals/evidence: await insert(t).values(v) → []
    // 양쪽 모두 동작하도록 chainable thenable로 모의.
    const fakeDb = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({
            table: getTableName(table as Parameters<typeof getTableName>[0]),
            values,
          });
          const chainable: {
            then: Promise<unknown[]>['then'];
            returning: () => { execute: () => Promise<{ id: string }[]> };
          } = {
            // await 시 빈 배열 반환 (signals/evidence path)
            then: ((onFulfilled, onRejected) =>
              Promise.resolve([]).then(onFulfilled, onRejected)) as Promise<unknown[]>['then'],
            // .returning(...).execute() 체인 (runs path)
            returning: () => ({
              execute: async () => [{ id: 'run-uuid-1' }],
            }),
          };
          return chainable;
        },
      }),
    } as Parameters<typeof persistRun>[0];

    const out: RunOutput = {
      signals: [
        {
          signal: 'burst',
          score: 50,
          confidence: 0.8,
          evidence: [
            {
              signal: 'burst',
              severity: 'medium',
              title: 'T',
              summary: 'S',
              visualization: { kind: 'burst-heatmap', buckets: [] },
              rawRefs: [],
              rank: 0,
            },
          ],
          metrics: { maxZ: 4 },
          computeMs: 10,
        },
      ],
      aggregate: {
        manipulationScore: 50,
        confidenceFactor: 0.8,
        signalScores: {
          burst: 50,
          similarity: 0,
          vote: 0,
          'media-sync': 0,
          'trend-shape': 0,
          'cross-platform': 0,
          temporal: 0,
        },
      },
    };

    const runId = await persistRun(fakeDb, {
      jobId: 1,
      subscriptionId: null,
      output: out,
      weightsVersion: 'v1-political',
    });

    expect(runId).toBe('run-uuid-1');
    const tables = inserts.map((i) => i.table);
    expect(tables).toContain('manipulation_runs');
    expect(tables).toContain('manipulation_signals');
    expect(tables).toContain('manipulation_evidence');
  });
});
