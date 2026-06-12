// pg Pool idle client error 내성 테스트 (이슈 #154 유형 A 회귀 방지)
// 2026-06-11 사건: idle client의 connect ETIMEDOUT이 Pool의 unhandled 'error'
// 이벤트로 승격되어 워커 프로세스가 즉사 (하루 9회 재부팅). pool.on('error')
// 리스너가 있으면 EventEmitter가 throw하지 않고 로그만 남긴다.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDb } from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collector pg Pool error 내성', () => {
  it("idle client 'error' 이벤트가 throw로 승격되지 않는다 (리스너 존재)", () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pool = getDb().$client;

    // 리스너가 없으면 EventEmitter 규약상 emit('error')가 동기 throw → 프로세스 즉사 재현
    expect(() => pool.emit('error', new Error('connect ETIMEDOUT'))).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });
});
