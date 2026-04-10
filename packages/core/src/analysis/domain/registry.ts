/**
 * 도메인 레지스트리
 * AnalysisDomain 문자열로 DomainConfig를 조회한다.
 */
import type { AnalysisDomain, DomainConfig } from './types';
import { POLITICAL_DOMAIN } from './domains/political';
import { FANDOM_DOMAIN } from './domains/fandom';

const REGISTRY: Record<AnalysisDomain, DomainConfig> = {
  political: POLITICAL_DOMAIN,
  fandom: FANDOM_DOMAIN,
};

/** 도메인 설정 조회 */
export function getDomainConfig(domain: AnalysisDomain): DomainConfig {
  return REGISTRY[domain];
}

/** 모든 지원 도메인 목록 */
export function getSupportedDomains(): AnalysisDomain[] {
  return Object.keys(REGISTRY) as AnalysisDomain[];
}
