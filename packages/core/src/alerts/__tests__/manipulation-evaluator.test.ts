import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateManipulationAlerts } from '../manipulation-evaluator';

const sendNotification = vi.fn();
const collectorGet = vi.fn();
const dbSelect = vi.fn();
const dbUpdate = vi.fn();

vi.mock('../channels', () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}));

vi.mock('../../collector-client', () => ({
  getCollectorClient: () => ({
    subscriptions: { get: { query: (...args: unknown[]) => collectorGet(...args) } },
  }),
}));

vi.mock('../../db', () => ({
  getDb: () => ({
    select: (...args: unknown[]) => dbSelect(...args),
    update: (...args: unknown[]) => dbUpdate(...args),
  }),
}));

// helper: drizzle chain mock — select().from(table).where(cond).limit?(n)
function makeSelectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
        then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  const setSpy = vi.fn().mockReturnValue({
    where: () => Promise.resolve(),
  });
  return { set: setSpy, _setSpy: setSpy };
}

const baseRule = {
  id: 1,
  subscriptionId: 37,
  name: '기본 규칙',
  enabled: true,
  scoreThreshold: 50,
  cooldownMinutes: 360,
  channel: { type: 'slack' as const, webhookUrl: 'https://hooks.slack.com/services/X/Y/Z' },
  lastTriggeredAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseRun = {
  id: 'run-1',
  jobId: 273,
  subscriptionId: 37,
  status: 'completed',
  manipulationScore: 60,
  confidenceFactor: 0.8,
};

describe('evaluateManipulationAlerts', () => {
  beforeEach(() => {
    sendNotification.mockReset();
    collectorGet.mockReset();
    dbSelect.mockReset();
    dbUpdate.mockReset();
  });

  it('1. 임계 미만이면 발화 없음 + lastTriggeredAt 변경 없음', async () => {
    const rule = { ...baseRule, scoreThreshold: 70 };
    const run = { ...baseRun, manipulationScore: 50 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain([]));
    collectorGet.mockResolvedValue({ keyword: '대선' });

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('2. 임계 이상 + cooldown 경과 — 발화 + payload 검증 + lastTriggeredAt UPDATE', async () => {
    const rule = { ...baseRule, scoreThreshold: 50, lastTriggeredAt: null };
    const run = { ...baseRun, manipulationScore: 60, confidenceFactor: 0.84 };
    const signals = [
      { id: 's1', signal: 'burst', score: 80 },
      { id: 's2', signal: 'similarity', score: 70 },
      { id: 's3', signal: 'vote', score: 60 },
      { id: 's4', signal: 'temporal', score: 30 },
    ];
    const updateChain = makeUpdateChain();

    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain(signals));
    collectorGet.mockResolvedValue({ keyword: '대선' });
    dbUpdate.mockReturnValue(updateChain);

    process.env.APP_BASE_URL = 'https://signalcraft.example.com';
    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [channel, message, data] = sendNotification.mock.calls[0];
    expect(channel).toEqual({ slack: { webhookUrl: rule.channel.webhookUrl } });
    expect(message).toContain('대선');
    expect(message).toContain('60.0');
    expect(message).toContain('50');
    expect(data).toMatchObject({
      ruleId: 1,
      subscriptionId: 37,
      jobId: 273,
      runId: 'run-1',
      score: 60,
      confidence: 0.84,
      threshold: 50,
      topSignals: ['burst', 'similarity', 'vote'],
      showcaseUrl: 'https://signalcraft.example.com/showcase/273',
      subscriptionKeyword: '대선',
    });
    expect(dbUpdate).toHaveBeenCalledTimes(1);
    expect(updateChain._setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lastTriggeredAt: expect.any(Date) }),
    );
  });

  it('3. 임계 이상 + cooldown 미경과 — skip', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000); // 1시간 전
    const rule = { ...baseRule, scoreThreshold: 50, cooldownMinutes: 360, lastTriggeredAt: recent };
    const run = { ...baseRun, manipulationScore: 60 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain([]));
    collectorGet.mockResolvedValue({ keyword: '대선' });

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('4. 활성 규칙 없음 — early return (run 조회조차 안 함)', async () => {
    dbSelect.mockReturnValueOnce(makeSelectChain([]));

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(dbSelect).toHaveBeenCalledTimes(1);
    expect(collectorGet).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('5. collector 구독 조회 실패 — keyword=null로 graceful, 발화 정상', async () => {
    const rule = { ...baseRule, scoreThreshold: 50 };
    const run = { ...baseRun, manipulationScore: 60 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain([]));
    collectorGet.mockRejectedValue(new Error('collector down'));
    dbUpdate.mockReturnValue(makeUpdateChain());

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [, message, data] = sendNotification.mock.calls[0];
    expect(message).toContain('구독 37');
    expect(data.subscriptionKeyword).toBeNull();
  });
});
