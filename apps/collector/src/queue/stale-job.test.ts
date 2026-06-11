import { describe, it, expect } from 'vitest';
import { isStaleCatchupJob } from './stale-job';

describe('isStaleCatchupJob', () => {
  const H = 3600_000;
  const now = Date.parse('2026-06-11T00:00:00Z');

  it('윈도우 끝이 interval 이내면 신선한 잡 — false', () => {
    const endISO = new Date(now - 1 * H).toISOString();
    expect(isStaleCatchupJob(endISO, 6, now)).toBe(false);
  });

  it('윈도우 끝이 interval보다 과거면 백로그 잡 — true', () => {
    const endISO = new Date(now - 13 * H).toISOString();
    expect(isStaleCatchupJob(endISO, 6, now)).toBe(true);
  });

  it('경계(정확히 interval)는 false — 정상 스케줄 잡을 백로그로 오판하지 않는다', () => {
    const endISO = new Date(now - 6 * H).toISOString();
    expect(isStaleCatchupJob(endISO, 6, now)).toBe(false);
  });

  it('잘못된 ISO 문자열은 보수적으로 false', () => {
    expect(isStaleCatchupJob('not-a-date', 6, now)).toBe(false);
  });
});
