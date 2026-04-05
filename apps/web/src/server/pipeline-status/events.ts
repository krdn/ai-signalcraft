// 파이프라인 이벤트 로그 합성
import { MODULE_LABELS, SOURCE_LABELS } from './labels';

export type EventLevel = 'info' | 'warn' | 'error';
export interface PipelineEvent {
  timestamp: string;
  level: EventLevel;
  message: string;
}

interface AnalysisModuleDetailed {
  module: string;
  status: string;
  stage: number;
  usage: { input: number; output: number; provider: string; model: string } | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

interface SourceDetailResult {
  status: string;
  articles: number;
  comments: number;
  videos: number;
  posts: number;
}

export function buildEventLog(params: {
  keyword: string;
  jobStatus: string;
  timeline: { jobCreatedAt: string; jobUpdatedAt: string; reportCompletedAt: string | null };
  progress: Record<string, any> | null;
  errorDetails: Record<string, string> | null;
  sourceDetails: Record<string, SourceDetailResult>;
  analysisModulesDetailed: AnalysisModuleDetailed[];
  reportMeta: {
    reportModel?: { provider: string; model: string };
    totalTokens?: number;
  } | null;
  hasReport: boolean;
  isCancelled: boolean;
  isPaused: boolean;
  collectionDone: boolean;
  collectionFailed: boolean;
}): PipelineEvent[] {
  const events: PipelineEvent[] = [];
  const {
    keyword,
    jobStatus,
    timeline,
    progress,
    errorDetails,
    sourceDetails,
    analysisModulesDetailed,
    reportMeta,
    hasReport,
    isCancelled,
    isPaused,
    collectionDone,
    collectionFailed,
  } = params;

  events.push({
    timestamp: timeline.jobCreatedAt,
    level: 'info',
    message: `파이프라인 시작: "${keyword}" 분석`,
  });

  // 소스별 수집 이벤트
  if (progress) {
    for (const [key, val] of Object.entries(progress)) {
      if (key === '_events' || key === 'report') continue;
      const label = SOURCE_LABELS[key] ?? key;
      const parts: string[] = [];
      if (val.articles > 0) parts.push(`기사 ${val.articles}건`);
      if (val.videos > 0) parts.push(`영상 ${val.videos}건`);
      if (val.posts > 0) parts.push(`게시글 ${val.posts}건`);
      if (val.comments > 0) parts.push(`댓글 ${val.comments}건`);
      const detail = parts.length > 0 ? parts.join(', ') : '0건';

      if (val.status === 'completed') {
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: 'info',
          message: `${label} 수집 완료 (${detail})`,
        });
      } else if (val.status === 'failed') {
        events.push({
          timestamp: timeline.jobUpdatedAt,
          level: 'error',
          message: `${label} 수집 실패: ${errorDetails?.[key] ?? '알 수 없는 오류'}`,
        });
      } else if (val.status === 'running') {
        events.push({
          timestamp: timeline.jobCreatedAt,
          level: 'info',
          message: `${label} 수집 중... (현재 ${detail})`,
        });
      }
    }
  }

  // 상태 이벤트
  if (isCancelled) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'warn',
      message: '파이프라인이 사용자에 의해 중지되었습니다',
    });
  } else if (isPaused) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'warn',
      message: '파이프라인이 일시정지 중입니다',
    });
  } else if (collectionDone) {
    const allSources = Object.values(sourceDetails);
    const totalArts = allSources.reduce((s, d) => s + d.articles, 0);
    const totalCmts = allSources.reduce((s, d) => s + d.comments, 0);
    const totalVids = allSources.reduce((s, d) => s + d.videos, 0);
    const totalPsts = allSources.reduce((s, d) => s + d.posts, 0);
    const summaryParts: string[] = [];
    if (totalArts > 0) summaryParts.push(`기사 ${totalArts}`);
    if (totalVids > 0) summaryParts.push(`영상 ${totalVids}`);
    if (totalPsts > 0) summaryParts.push(`게시글 ${totalPsts}`);
    if (totalCmts > 0) summaryParts.push(`댓글 ${totalCmts}`);
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: jobStatus === 'partial_failure' ? 'warn' : 'info',
      message:
        jobStatus === 'partial_failure'
          ? `수집 부분 완료 (${summaryParts.join(' + ')}, 일부 소스 실패)`
          : `수집 완료 (${summaryParts.join(' + ')})`,
    });
  } else if (collectionFailed) {
    events.push({
      timestamp: timeline.jobUpdatedAt,
      level: 'error',
      message: '수집 실패 — 파이프라인 중단',
    });
  }

  // 분석 모듈 이벤트
  for (const mod of analysisModulesDetailed) {
    const label = MODULE_LABELS[mod.module] ?? mod.module;
    const stageLabel = `Stage ${mod.stage}`;

    if (mod.startedAt) {
      const providerInfo = mod.usage?.provider ? ` [${mod.usage.provider}/${mod.usage.model}]` : '';
      events.push({
        timestamp: mod.startedAt,
        level: 'info',
        message: `${label} 분석 시작 (${stageLabel})${providerInfo}`,
      });
    }

    if (mod.status === 'completed' && mod.completedAt) {
      const infoParts: string[] = [];
      if (mod.usage?.model) infoParts.push(mod.usage.model);
      if (mod.usage)
        infoParts.push(`${(mod.usage.input + mod.usage.output).toLocaleString()} 토큰`);
      if (mod.durationSeconds != null) infoParts.push(`${mod.durationSeconds}초`);
      events.push({
        timestamp: mod.completedAt,
        level: 'info',
        message: `${label} 분석 완료${infoParts.length > 0 ? ` (${infoParts.join(', ')})` : ''}`,
      });
    } else if (mod.status === 'failed' && mod.completedAt) {
      events.push({
        timestamp: mod.completedAt,
        level: 'error',
        message: `${label} 분석 실패: ${mod.errorMessage ?? '알 수 없는 오류'}`,
      });
    }
  }

  // 리포트 이벤트
  if (hasReport && timeline.reportCompletedAt) {
    const reportModelStr = reportMeta?.reportModel
      ? ` [${reportMeta.reportModel.provider}/${reportMeta.reportModel.model}]`
      : '';
    const reportTokenStr = reportMeta?.totalTokens
      ? `, ${reportMeta.totalTokens.toLocaleString()} 토큰`
      : '';
    events.push({
      timestamp: timeline.reportCompletedAt,
      level: 'info',
      message: `종합 리포트 생성 완료${reportModelStr}${reportTokenStr ? ` (${reportTokenStr.slice(2)})` : ''}`,
    });
  }

  // Worker 이벤트 병합
  const rawEvents = (progress as Record<string, any> | null)?._events;
  if (Array.isArray(rawEvents)) {
    for (const ev of rawEvents) {
      if (ev && ev.ts && ev.level && ev.msg) {
        events.push({ timestamp: ev.ts, level: ev.level, message: ev.msg });
      }
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return events;
}
