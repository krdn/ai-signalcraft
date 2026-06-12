// pg Pool idle client error 내성 테스트 (이슈 #154 동일 결함 — core 측)
// collector 워커와 동일하게 core의 lazy Pool(getDb)·eager Pool(db) 모두
// 'error' 리스너가 없으면 idle client 소켓 에러가 프로세스를 즉사시킨다.
// (analysis-worker는 getDb, Next.js는 eager db 사용)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDb, db } from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('core pg Pool error 내성', () => {
  it("lazy Pool(getDb): idle client 'error' 이벤트가 throw로 승격되지 않는다", () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool = getDb().$client;

    expect(() => pool.emit('error', new Error('connect ETIMEDOUT'))).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });

  it("eager Pool(db): idle client 'error' 이벤트가 throw로 승격되지 않는다", () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool = db.$client;

    expect(() => pool.emit('error', new Error('connect ETIMEDOUT'))).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });
});
