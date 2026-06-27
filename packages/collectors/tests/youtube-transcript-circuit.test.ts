import { describe, it, expect } from 'vitest';
import { evaluateTranscriptCircuit, type CircuitState } from '../src/adapters/youtube-collector';

const INITIAL: CircuitState = { blockedCount: 0, open: false, skipped: 0 };
const THRESHOLD = 2;

describe('evaluateTranscriptCircuit', () => {
  it('성공 결과는 상태를 바꾸지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: true, text: 'x', lang: 'ko' }, THRESHOLD);
    expect(next).toEqual(INITIAL);
  });

  it('no_tracks(blocked:false)는 blockedCount를 올리지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: false }, THRESHOLD);
    expect(next.blockedCount).toBe(0);
    expect(next.open).toBe(false);
  });

  it('차단 1회는 회로를 열지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: true }, THRESHOLD);
    expect(next.blockedCount).toBe(1);
    expect(next.open).toBe(false);
  });

  it('차단 2회 누적 시 회로가 열린다', () => {
    const after1 = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: true }, THRESHOLD);
    const after2 = evaluateTranscriptCircuit(after1, { ok: false, blocked: true }, THRESHOLD);
    expect(after2.blockedCount).toBe(2);
    expect(after2.open).toBe(true);
  });

  it('이미 열린 회로에 추가 차단이 와도 멱등하게 유지', () => {
    const open: CircuitState = { blockedCount: 2, open: true, skipped: 0 };
    const next = evaluateTranscriptCircuit(open, { ok: false, blocked: true }, THRESHOLD);
    expect(next.open).toBe(true);
    expect(next.blockedCount).toBe(3);
  });

  it('입력 상태를 변형하지 않는다(불변)', () => {
    const frozen = Object.freeze({ ...INITIAL });
    expect(() =>
      evaluateTranscriptCircuit(frozen, { ok: false, blocked: true }, THRESHOLD),
    ).not.toThrow();
  });
});

describe('차단 자동 스킵 게이트 (transcriptCircuitEnabled)', () => {
  // collect 루프의 게이트 동작 재현: enabled=false면 evaluateTranscriptCircuit를
  // 호출하지 않으므로, 차단이 아무리 누적돼도 회로가 열리지 않는다.
  function runLoop(enabled: boolean, results: Array<{ ok: false; blocked: boolean }>) {
    let circuit: CircuitState = { blockedCount: 0, open: false, skipped: 0 };
    for (const result of results) {
      if (enabled && circuit.open) {
        circuit = { ...circuit, skipped: circuit.skipped + 1 };
      } else if (enabled) {
        circuit = evaluateTranscriptCircuit(circuit, result, THRESHOLD);
      }
      // enabled=false면 회로 상태를 전혀 건드리지 않음
    }
    return circuit;
  }

  it('게이트 ON: 차단 3회면 회로가 열리고 스킵이 누적된다', () => {
    const blocked = { ok: false as const, blocked: true };
    const final = runLoop(true, [blocked, blocked, blocked]);
    expect(final.open).toBe(true);
    expect(final.skipped).toBe(1); // 3번째는 이미 open이라 스킵
  });

  it('게이트 OFF: 차단이 누적돼도 회로가 절대 열리지 않는다', () => {
    const blocked = { ok: false as const, blocked: true };
    const final = runLoop(false, [blocked, blocked, blocked, blocked]);
    expect(final.open).toBe(false);
    expect(final.blockedCount).toBe(0);
    expect(final.skipped).toBe(0);
  });
});
