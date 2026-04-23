// 리포트 배포 모듈 — 이메일, Slack, Webhook으로 완료된 리포트 배포
import { createLogger } from '../utils/logger';

const logger = createLogger('report-distributor');

export interface DistributionConfig {
  channels: {
    email?: string[]; // 수신자 이메일 목록
    slack?: { webhookUrl: string };
    webhook?: { url: string; headers?: Record<string, string> };
  };
  reportUrl: string; // 앱 내 리포트 링크
  jobId: number;
  keyword: string;
  status: string; // completed | partial_failure
}

export async function distributeReport(config: DistributionConfig): Promise<void> {
  const { channels, reportUrl, keyword, status, jobId } = config;
  const summary = `[AI SignalCraft] 분석 완료: "${keyword}" (${status}) — ${reportUrl}`;

  if (channels.email?.length) {
    // 이메일 발송 — 현재는 로깅만, 향후 Resend 연동 가능
    logger.info(`리포트 이메일 발송: ${channels.email.join(', ')} — ${summary}`);
  }

  if (channels.slack?.webhookUrl) {
    try {
      await fetch(channels.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: summary,
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*분석 완료* — "${keyword}"` },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*상태:* ${status === 'completed' ? '✅ 완료' : '⚠️ 부분 실패'}`,
                },
                { type: 'mrkdwn', text: `*작업 ID:* ${jobId}` },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '리포트 보기' },
                  url: reportUrl,
                },
              ],
            },
          ],
        }),
      });
      logger.info(`Slack 알림 발송 완료: jobId=${jobId}`);
    } catch (err) {
      logger.error(`Slack 알림 발송 실패: ${err}`);
    }
  }

  if (channels.webhook?.url) {
    try {
      await fetch(channels.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...channels.webhook.headers },
        body: JSON.stringify({
          jobId,
          keyword,
          status,
          reportUrl,
          completedAt: new Date().toISOString(),
        }),
      });
      logger.info(`Webhook 알림 발송 완료: jobId=${jobId}`);
    } catch (err) {
      logger.error(`Webhook 알림 발송 실패: ${err}`);
    }
  }
}
