/**
 * 도메인 사전 레지스트리
 * AnalysisDomain으로 DomainLexicon을 조회한다.
 */
import type { AnalysisDomain } from '../../domain/types';
import type { DomainLexicon } from './types';
import { POLITICAL_LEXICON } from './political';
import { FANDOM_LEXICON } from './fandom';
import { PR_LEXICON } from './pr';
import { CORPORATE_LEXICON } from './corporate';
import { POLICY_LEXICON } from './policy';
import { FINANCE_LEXICON } from './finance';
import { HEALTHCARE_LEXICON } from './healthcare';
import { PUBLIC_SECTOR_LEXICON } from './public-sector';
import { EDUCATION_LEXICON } from './education';
import { SPORTS_LEXICON } from './sports';
import { LEGAL_LEXICON } from './legal';
import { RETAIL_LEXICON } from './retail';
import { createDefaultLexicon } from './defaults';

const REGISTRY: Record<AnalysisDomain, DomainLexicon> = {
  political: POLITICAL_LEXICON,
  fandom: FANDOM_LEXICON,
  pr: PR_LEXICON,
  corporate: CORPORATE_LEXICON,
  policy: POLICY_LEXICON,
  finance: FINANCE_LEXICON,
  healthcare: HEALTHCARE_LEXICON,
  'public-sector': PUBLIC_SECTOR_LEXICON,
  education: EDUCATION_LEXICON,
  sports: SPORTS_LEXICON,
  legal: LEGAL_LEXICON,
  retail: RETAIL_LEXICON,
};

/** 도메인 사전 조회. 미등록 도메인은 기본(공통만) 사전 반환 */
export function getDomainLexicon(domain: AnalysisDomain | undefined): DomainLexicon {
  if (!domain) return createDefaultLexicon('political');
  return REGISTRY[domain] ?? createDefaultLexicon(domain);
}
