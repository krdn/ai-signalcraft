/* eslint-disable import-x/order */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const executeMock = vi.fn();
vi.mock('../index', () => ({
  getDb: () => ({ execute: executeMock }),
}));

import {
  verifyHypertableConstraints,
  assertHypertableConstraints,
} from './verify-hypertable-constraints';

describe('verifyHypertableConstraints', () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  it('모든 UNIQUE INDEX가 존재하면 ok=true', async () => {
    executeMock.mockResolvedValue({ rows: [{ indexname: 'raw_items_dedup_uniq' }] });
    const r = await verifyHypertableConstraints();
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('UNIQUE INDEX가 누락되면 missing에 힌트 포함해 반환', async () => {
    executeMock.mockResolvedValue({ rows: [] });
    const r = await verifyHypertableConstraints();
    expect(r.ok).toBe(false);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0]).toContain('raw_items.raw_items_dedup_uniq');
    expect(r.missing[0]).toContain('ON CONFLICT');
  });
});

describe('assertHypertableConstraints', () => {
  const exitSpy = vi.spyOn(process, 'exit');
  const errorSpy = vi.spyOn(console, 'error');

  beforeEach(() => {
    executeMock.mockReset();
    exitSpy.mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    errorSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockReset();
    errorSpy.mockReset();
  });

  it('정상 상태에서는 exit하지 않음', async () => {
    executeMock.mockResolvedValue({ rows: [{ indexname: 'raw_items_dedup_uniq' }] });
    await expect(assertHypertableConstraints()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('누락 시 기본(hard-fail)은 process.exit(1) + 에러 로그', async () => {
    executeMock.mockResolvedValue({ rows: [] });
    await expect(assertHypertableConstraints()).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    const logged = errorSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('db:migrate-timescale');
  });

  it('softFail=true이면 exit하지 않고 경고만', async () => {
    executeMock.mockResolvedValue({ rows: [] });
    await expect(assertHypertableConstraints({ softFail: true })).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
    const logged = errorSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('db:migrate-timescale');
  });
});
