// 알림 채널 전송 — email, Slack webhook, generic webhook
import { createLogger } from '../utils/logger';

const log = createLogger('alerts:channels');

export interface AlertChannelEmail {
  email: true;
}

export interface AlertChannelSlack {
  slack: { webhookUrl: string };
}

export interface AlertChannelWebhook {
  webhook: { url: string; headers?: Record<string, string> };
}

export type AlertChannel = AlertChannelEmail | AlertChannelSlack | AlertChannelWebhook;

/**
 * 알림 채널로 메시지 전송
 * 실패해도 예외를 던지지 않고 로그만 남김 (알림 실패가 파이프라인에 영향 없도록)
 */
export async function sendNotification(
  channel: AlertChannel,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    if ('email' in channel && channel.email) {
      await sendEmailNotification(message, data);
    } else if ('slack' in channel && channel.slack) {
      await sendSlackNotification(channel.slack.webhookUrl, message, data);
    } else if ('webhook' in channel && channel.webhook) {
      await sendWebhookNotification(channel.webhook.url, channel.webhook.headers, message, data);
    } else {
      log.warn('알 수 없는 알림 채널 타입:', Object.keys(channel));
    }
  } catch (err) {
    log.error('알림 전송 실패:', err);
  }
}

/** 이메일 알림 — 현재는 로그만 남기고 추후 Resend 통합 예정 */
async function sendEmailNotification(
  message: string,
  _data: Record<string, unknown>,
): Promise<void> {
  // TODO: Resend API 연동 시 구현
  log.info(`[email] 알림: ${message}`);
}

/** Slack webhook 전송 — Block Kit 포맷 */
async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 AI SignalCraft 알림',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `트리거: *${(data.triggerType as string) || 'unknown'}*`,
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    log.error(`Slack webhook 실패: ${response.status} ${response.statusText}`);
  }
}

/** Generic webhook 전송 */
async function sendWebhookNotification(
  url: string,
  headers: Record<string, string> | undefined,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      message,
      data,
      timestamp: new Date().toISOString(),
      source: 'ai-signalcraft',
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    log.error(`Webhook 실패: ${response.status} ${response.statusText}`);
  }
}
