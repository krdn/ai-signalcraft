/**
 * 도메인 레지스트리
 * AnalysisDomain 문자열로 DomainConfig를 조회한다.
 */
import type { AnalysisDomain, DomainConfig } from './types';
import { POLITICAL_DOMAIN } from './domains/political';
import { FANDOM_DOMAIN } from './domains/fandom';
import { PR_DOMAIN } from './domains/pr';
import { CORPORATE_DOMAIN } from './domains/corporate';
import { POLICY_DOMAIN } from './domains/policy';
import { FINANCE_DOMAIN } from './domains/finance';
import { HEALTHCARE_DOMAIN } from './domains/healthcare';
import { PUBLIC_SECTOR_DOMAIN } from './domains/public-sector';
import { EDUCATION_DOMAIN } from './domains/education';
import { SPORTS_DOMAIN } from './domains/sports';
import { LEGAL_DOMAIN } from './domains/legal';
import { RETAIL_DOMAIN } from './domains/retail';

const REGISTRY: Record<AnalysisDomain, DomainConfig> = {
  political: POLITICAL_DOMAIN,
  fandom: FANDOM_DOMAIN,
  pr: PR_DOMAIN,
  corporate: CORPORATE_DOMAIN,
  policy: POLICY_DOMAIN,
  finance: FINANCE_DOMAIN,
  healthcare: HEALTHCARE_DOMAIN,
  'public-sector': PUBLIC_SECTOR_DOMAIN,
  education: EDUCATION_DOMAIN,
  sports: SPORTS_DOMAIN,
  legal: LEGAL_DOMAIN,
  retail: RETAIL_DOMAIN,
};

/** 도메인 설정 조회 */
export function getDomainConfig(domain: AnalysisDomain): DomainConfig {
  return REGISTRY[domain];
}

/** 모든 지원 도메인 목록 */
export function getSupportedDomains(): AnalysisDomain[] {
  return Object.keys(REGISTRY) as AnalysisDomain[];
}
