import { describe, it, expect } from 'vitest';
import {
  buildQualityMetadata,
  appendQualityFooterToMarkdown,
} from '../src/analysis/quality-metadata';

describe('buildQualityMetadata', () => {
  it('rate-limit warn 2건 + sampling 130 → 모든 flag true', () => {
    const progress = {
      _events: [
        {
          ts: '2026-04-26T04:44:36Z',
          level: 'warn',
          msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity on this model. Your quota will reset after 0s.',
        },
        {
          ts: '2026-04-26T04:45:27Z',
          level: 'warn',
          msg: 'macro-view 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: You have exhausted your capacity.',
        },
      ],
      sampling: {
        articles: { totalSampled: 130 },
        comments: { totalSampled: 200 },
      },
    };
    const m = buildQualityMetadata(progress);
    expect(m.qualityFlags.hasRateLimitFailures).toBe(true);
    expect(m.qualityFlags.hasPartialModules).toBe(true);
    expect(m.qualityFlags.samplingShallow).toBe(true); // articles 130 < 200
    expect(m.modulesPartial).toHaveLength(2);
    expect(m.modulesPartial[0].module).toBe('segmentation');
    expect(m.modulesPartial[0].reason).toBe('rate-limit');
    expect(m.warnings).toHaveLength(2);
    expect(m.warnings[0].phase).toBe('analysis');
    expect(m.warnings[0].module).toBe('segmentation');
  });

  it('parse-error reason 분류', () => {
    const progress = {
      _events: [
        {
          ts: 't',
          level: 'warn',
          msg: 'final-summary 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: Failed to parse JSON response.',
        },
      ],
    };
    const m = buildQualityMetadata(progress);
    expect(m.modulesPartial[0].reason).toBe('parse-error');
    expect(m.qualityFlags.hasRateLimitFailures).toBe(false);
    expect(m.qualityFlags.hasPartialModules).toBe(true);
  });

  it('빈 progress → 모든 flag false', () => {
    const m = buildQualityMetadata({});
    expect(m.qualityFlags.hasRateLimitFailures).toBe(false);
    expect(m.qualityFlags.hasPartialModules).toBe(false);
    expect(m.qualityFlags.samplingShallow).toBe(false);
    expect(m.modulesPartial).toHaveLength(0);
    expect(m.warnings).toHaveLength(0);
  });

  it('null progress → 모든 flag false', () => {
    const m = buildQualityMetadata(null);
    expect(m.qualityFlags.hasPartialModules).toBe(false);
  });

  it('동일 모듈 중복 warn은 modulesPartial에서 1회만', () => {
    const progress = {
      _events: [
        {
          ts: 't1',
          level: 'warn',
          msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: exhausted.',
        },
        {
          ts: 't2',
          level: 'warn',
          msg: 'segmentation 청크 분석 실패 (계속 진행): Failed after 3 attempts. Last error: exhausted.',
        },
      ],
    };
    const m = buildQualityMetadata(progress);
    expect(m.modulesPartial).toHaveLength(1);
    expect(m.warnings).toHaveLength(2); // warnings는 모두 보존
  });

  it('chunk failure 패턴이 아닌 warn은 modulesPartial 미포함', () => {
    const progress = {
      _events: [{ ts: 't', level: 'warn', msg: 'macro-view dailyMentionTrend: AI가 빈 배열 반환' }],
    };
    const m = buildQualityMetadata(progress);
    expect(m.modulesPartial).toHaveLength(0);
    expect(m.warnings).toHaveLength(1);
    expect(m.warnings[0].module).toBeNull();
    expect(m.warnings[0].phase).toBeNull();
  });

  it('comments totalSampled < 200이어도 samplingShallow=true', () => {
    const progress = {
      sampling: {
        articles: { totalSampled: 300 },
        comments: { totalSampled: 100 },
      },
    };
    const m = buildQualityMetadata(progress);
    expect(m.qualityFlags.samplingShallow).toBe(true);
  });
});

describe('appendQualityFooterToMarkdown', () => {
  const baseMeta = {
    modulesPartial: [],
    warnings: [],
    qualityFlags: {
      hasRateLimitFailures: false,
      hasPartialModules: false,
      samplingShallow: false,
    },
  } as const;

  it('flags 모두 false → footer 없음', () => {
    const out = appendQualityFooterToMarkdown('# 본문', baseMeta);
    expect(out).toBe('# 본문');
  });

  it('hasPartialModules true → footer 포함', () => {
    const meta = {
      modulesPartial: [
        {
          module: 'segmentation',
          reason: 'rate-limit' as const,
          chunksTotal: null,
          chunksFailed: null,
        },
        {
          module: 'macro-view',
          reason: 'rate-limit' as const,
          chunksTotal: null,
          chunksFailed: null,
        },
      ],
      warnings: [],
      qualityFlags: { hasRateLimitFailures: true, hasPartialModules: true, samplingShallow: false },
    };
    const out = appendQualityFooterToMarkdown('# 본문', meta);
    expect(out).toContain('## ⚠️ 분석 경고');
    expect(out).toContain('segmentation, macro-view');
    expect(out).toContain('rate-limit으로 일부 청크 분석 누락');
  });

  it('samplingShallow만 true → 얕은 표본 항목 포함', () => {
    const meta = {
      ...baseMeta,
      qualityFlags: { ...baseMeta.qualityFlags, samplingShallow: true },
    };
    const out = appendQualityFooterToMarkdown('# 본문', meta);
    expect(out).toContain('얕은 표본');
    expect(out).toContain('200건 미만');
  });

  it('mixed reason → 일반 사유 문구', () => {
    const meta = {
      modulesPartial: [
        {
          module: 'segmentation',
          reason: 'rate-limit' as const,
          chunksTotal: null,
          chunksFailed: null,
        },
        {
          module: 'final-summary',
          reason: 'parse-error' as const,
          chunksTotal: null,
          chunksFailed: null,
        },
      ],
      warnings: [],
      qualityFlags: { hasRateLimitFailures: true, hasPartialModules: true, samplingShallow: false },
    };
    const out = appendQualityFooterToMarkdown('# 본문', meta);
    expect(out).toContain('일부 청크 분석 실패');
    expect(out).not.toContain('rate-limit으로 일부 청크 분석 누락');
  });
});
