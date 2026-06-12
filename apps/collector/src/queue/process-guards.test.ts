// 프로세스 레벨 크래시 가드 테스트 (이슈 #154)
// uncaughtException/unhandledRejection 핸들러가 없으면 워커가 무로그로 즉사해
// 사망 원인 추적이 불가능하다 (2026-06-11 유형 B). 가드는 원인을 로그한 뒤
// exit(1)로 종료해 docker restart가 깨끗하게 재기동하도록 한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerProcessGuards } from './worker-process';

// 테스트가 추가한 리스너만 정리하기 위해 기존 리스너를 기억
let priorUncaught: NodeJS.UncaughtExceptionListener[];
let priorRejection: NodeJS.UnhandledRejectionListener[];

beforeEach(() => {
  priorUncaught = process.listeners('uncaughtException');
  priorRejection = process.listeners('unhandledRejection');
});

afterEach(() => {
  for (const l of process.listeners('uncaughtException')) {
    if (!priorUncaught.includes(l)) process.removeListener('uncaughtException', l);
  }
  for (const l of process.listeners('unhandledRejection')) {
    if (!priorRejection.includes(l)) process.removeListener('unhandledRejection', l);
  }
  vi.restoreAllMocks();
});

describe('registerProcessGuards', () => {
  it('uncaughtException/unhandledRejection 핸들러를 등록한다', () => {
    registerProcessGuards();

    expect(process.listenerCount('uncaughtException')).toBe(priorUncaught.length + 1);
    expect(process.listenerCount('unhandledRejection')).toBe(priorRejection.length + 1);
  });

  it('uncaughtException 핸들러가 원인을 로그하고 exit(1)한다', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    registerProcessGuards();
    const handler = process.listeners('uncaughtException').at(-1);
    if (!handler) throw new Error('uncaughtException 핸들러 미등록');
    handler(new Error('boom'), 'uncaughtException');

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('uncaughtException'),
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('unhandledRejection 핸들러가 원인을 로그하고 exit(1)한다', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    registerProcessGuards();
    const handler = process.listeners('unhandledRejection').at(-1);
    if (!handler) throw new Error('unhandledRejection 핸들러 미등록');
    handler(new Error('rejected'), Promise.resolve());

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('unhandledRejection'),
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
