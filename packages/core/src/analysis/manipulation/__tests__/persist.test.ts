import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { persistRun, markRunFailed } from '../persist';
import type { RunOutput } from '../runner';
import type { Database } from '../../../db';

/**
 * Drizzle 트랜잭션 mock 빌더.
 *
 * persist.ts는 db.transaction(async (tx) => {...})를 호출하므로 mock은
 *   1) transaction(fn) 메서드를 노출
 *   2) tx로 callback에 전달되는 객체에 insert() chainable shape 노출
 *
 * insert chain은 두 형태를 모두 지원해야 함:
 *   - runs: insert(t).values(v).returning(...).execute() → [{id}]
 *   - signals/evidence: await insert(t).values(v) → []
 * runtime table 이름은 Symbol.for('drizzle:Name')에 있어 getTableName()로 추출.
 */
function createInsertMock(inserts: { table: string; values: unknown }[]) {
  return (table: unknown) => ({
    values: (values: unknown) => {
      inserts.push({
        table: getTableName(table as Parameters<typeof getTableName>[0]),
        values,
      });
      const chainable: {
        then: Promise<unknown[]>['then'];
        returning: () => { execute: () => Promise<{ id: string }[]> };
      } = {
        then: ((onFulfilled, onRejected) =>
          Promise.resolve([]).then(onFulfilled, onRejected)) as Promise<unknown[]>['then'],
        returning: () => ({
          execute: async () => [{ id: 'run-uuid-1' }],
        }),
      };
      return chainable;
    },
  });
}

function makeRunOutput(opts?: { signals?: RunOutput['signals'] }): RunOutput {
  return {
    signals: opts?.signals ?? [
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
}

describe('persistRun', () => {
  it('runs/signals/evidence 모두 INSERT 호출 (정상 케이스)', async () => {
    const inserts: { table: string; values: unknown }[] = [];
    const insertMock = createInsertMock(inserts);
    const fakeDb = {
      transaction: async <T>(fn: (tx: { insert: typeof insertMock }) => Promise<T>): Promise<T> =>
        fn({ insert: insertMock }),
    } as unknown as Database;

    const runId = await persistRun(fakeDb, {
      jobId: 1,
      subscriptionId: null,
      output: makeRunOutput(),
      weightsVersion: 'v1-political',
    });

    expect(runId).toBe('run-uuid-1');
    const tables = inserts.map((i) => i.table);
    expect(tables).toContain('manipulation_runs');
    expect(tables).toContain('manipulation_signals');
    expect(tables).toContain('manipulation_evidence');
  });

  it('빈 signals는 manipulation_runs만 INSERT (signals/evidence 스킵)', async () => {
    const inserts: { table: string; values: unknown }[] = [];
    const insertMock = createInsertMock(inserts);
    const fakeDb = {
      transaction: async <T>(fn: (tx: { insert: typeof insertMock }) => Promise<T>): Promise<T> =>
        fn({ insert: insertMock }),
    } as unknown as Database;

    const runId = await persistRun(fakeDb, {
      jobId: 1,
      subscriptionId: null,
      output: makeRunOutput({ signals: [] }),
      weightsVersion: 'v1-political',
    });

    expect(runId).toBe('run-uuid-1');
    const tables = inserts.map((i) => i.table);
    expect(tables).toEqual(['manipulation_runs']);
    expect(tables).not.toContain('manipulation_signals');
    expect(tables).not.toContain('manipulation_evidence');
  });

  it('runs INSERT가 id를 반환 안 하면 throw', async () => {
    const fakeDb = {
      transaction: async <T>(
        fn: (tx: {
          insert: () => {
            values: () => {
              returning: () => { execute: () => Promise<unknown[]> };
            };
          };
        }) => Promise<T>,
      ): Promise<T> =>
        fn({
          insert: () => ({
            values: () => ({
              returning: () => ({ execute: async () => [] }),
            }),
          }),
        }),
    } as unknown as Database;

    await expect(
      persistRun(fakeDb, {
        jobId: 1,
        subscriptionId: null,
        output: makeRunOutput(),
        weightsVersion: 'v1-political',
      }),
    ).rejects.toThrow('manipulation_runs INSERT returned no id');
  });
});

describe('markRunFailed', () => {
  it('runId로 status=failed UPDATE 호출', async () => {
    const updates: { table: string; setValues: Record<string, unknown> }[] = [];
    const fakeDb = {
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push({
              table: getTableName(table as Parameters<typeof getTableName>[0]),
              setValues: values,
            });
            return { rowCount: 1 };
          },
        }),
      }),
    } as unknown as Database;

    await markRunFailed(fakeDb, 'run-uuid-1', { message: 'test error', stack: 'trace' });

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe('manipulation_runs');
    expect(updates[0].setValues.status).toBe('failed');
    expect(updates[0].setValues.errorDetails).toEqual({
      message: 'test error',
      stack: 'trace',
    });
    expect(updates[0].setValues.completedAt).toBeInstanceOf(Date);
  });

  it('rowCount=0이면 console.warn (throw 안 함)', async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);
    try {
      const fakeDb = {
        update: () => ({
          set: () => ({
            where: async () => ({ rowCount: 0 }),
          }),
        }),
      } as unknown as Database;

      await expect(
        markRunFailed(fakeDb, 'missing-uuid', { message: 'x' }),
      ).resolves.toBeUndefined();
      expect(warnings.some((w) => w.includes('missing-uuid'))).toBe(true);
      expect(warnings.some((w) => w.includes('0 rows updated'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});
