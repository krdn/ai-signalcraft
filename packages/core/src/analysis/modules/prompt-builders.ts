import type { AnalysisDomain } from '../domain';
import { getDomainConfig } from '../domain';

/** 도메인에 따른 플랫폼 지식 블록 반환 */
export function getPlatformKnowledge(domain?: AnalysisDomain): string {
  const d = domain ?? 'political';
  return getDomainConfig(d).platformKnowledge;
}

/** 도메인에 따른 영향도 앵커 반환 */
export function getImpactScoreAnchor(domain?: AnalysisDomain): string {
  const d = domain ?? 'political';
  return getDomainConfig(d).impactScoreAnchor;
}

/** 도메인에 따른 프레임 강도 앵커 반환 */
export function getFrameStrengthAnchor(domain?: AnalysisDomain): string {
  const d = domain ?? 'political';
  return getDomainConfig(d).frameStrengthAnchor;
}

/** 도메인에 따른 확률 앵커 반환 */
export function getProbabilityAnchor(domain?: AnalysisDomain): string {
  const d = domain ?? 'political';
  return getDomainConfig(d).probabilityAnchor;
}

/**
 * 모듈별 시스템 프롬프트를 도메인에 맞게 조합.
 * domain registry에 오버라이드가 있으면 그것을 사용하고,
 * 없으면 기존 모듈의 기본 프롬프트를 반환한다.
 */
export function buildModuleSystemPrompt(
  moduleName: string,
  domain?: AnalysisDomain,
): string | null {
  const d = domain ?? 'political';
  const config = getDomainConfig(d);
  const override = config.modulePrompts[moduleName];
  if (override) {
    return override.systemPrompt;
  }
  // 오버라이드가 없으면 null 반환 → 모듈이 자체 기본 프롬프트 사용
  return null;
}

/** 집단 분류 기준 문구 반환 (segmentation 모듈용) */
export function getSegmentationCriteria(domain?: AnalysisDomain): string {
  const d = domain ?? 'political';
  const config = getDomainConfig(d);
  const { types, criteria } = config.segmentationLabels;
  return types.map((t) => `- **${t}**: ${criteria[t]}`).join('\n');
}
