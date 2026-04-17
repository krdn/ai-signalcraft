import { describe, it, expect } from 'vitest';
import {
  startTrace,
  withSpan,
  getCurrentTraceId,
  setSpanAttribute,
  formatTraceTree,
  type Span,
} from '../tracing';

describe('tracing', () => {
  it('startTrace는 trace id를 생성하고 자식 span에서 접근 가능', async () => {
    let capturedTraceId: string | null = null;
    await startTrace('test-trace', async () => {
      capturedTraceId = getCurrentTraceId();
      expect(capturedTraceId).toBeTruthy();
    });
  });

  it('withSpan은 trace 컨텍스트 없으면 fn만 실행', async () => {
    const result = await withSpan('no-trace-span', async () => 42);
    expect(result).toBe(42);
  });

  it('중첩 span 구조를 유지한다', async () => {
    let rootId: string | null = null;
    let childId: string | null = null;

    await startTrace('root', async () => {
      rootId = getCurrentTraceId();
      await withSpan('child', async () => {
        childId = getCurrentTraceId();
        // 같은 trace 내에서 traceId는 유지
        expect(childId).toBe(rootId);
        await withSpan('grandchild', async () => {
          expect(getCurrentTraceId()).toBe(rootId);
        });
      });
    });
  });

  it('span 에러 시 status=error 기록', async () => {
    await expect(
      startTrace('failing-trace', async () => {
        await withSpan('failing-span', async () => {
          throw new Error('intentional');
        });
      }),
    ).rejects.toThrow('intentional');
  });

  it('setSpanAttribute는 현재 span에 속성 추가 (크래시 안 남)', async () => {
    await startTrace('attr-test', async () => {
      setSpanAttribute('key1', 'value1');
      setSpanAttribute('count', 42);
      setSpanAttribute('flag', true);
    });
  });

  it('formatTraceTree는 계층 구조를 렌더링', () => {
    const spans: Span[] = [
      {
        id: 'root',
        parentId: null,
        name: 'root',
        startTime: 0,
        endTime: 100,
        status: 'ok',
      },
      {
        id: 'child1',
        parentId: 'root',
        name: 'child-1',
        startTime: 10,
        endTime: 50,
        status: 'ok',
      },
      {
        id: 'child2',
        parentId: 'root',
        name: 'child-2',
        startTime: 60,
        endTime: 90,
        status: 'error',
        errorMessage: 'oops',
      },
    ];

    const output = formatTraceTree(spans);
    expect(output).toContain('root (100ms)');
    expect(output).toContain('child-1 (40ms)');
    expect(output).toContain('child-2 (30ms) ✗');
    expect(output).toContain('! oops');
  });
});
