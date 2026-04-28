import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendNotification } from '../channels';

describe('channels — fetch timeout', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Slack webhook fetch에 AbortSignal이 전달됨 (5초 timeout 설정 확인)', async () => {
    // fetch가 즉시 성공하도록 mock — signal 포함 여부 검증이 목적
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;

    await sendNotification(
      { slack: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/X' } },
      'test',
      {},
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T0/B0/X',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('Slack webhook fetch가 AbortError를 throw해도 sendNotification은 throw 안 함', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('aborted', 'AbortError')) as typeof fetch;

    await expect(
      sendNotification(
        { slack: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/X' } },
        'test',
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
