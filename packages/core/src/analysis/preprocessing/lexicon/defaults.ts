/**
 * 기본 도메인 사전 (공통 규칙만 적용)
 * 도메인별 특화 사전이 아직 없는 경우 사용한다.
 */
import type { AnalysisDomain } from '../../domain/types';
import type { DomainLexicon } from './types';

export function createDefaultLexicon(domain: AnalysisDomain): DomainLexicon {
  return {
    domain,
    slang: [],
    obfuscation: [],
    entities: [],
    sarcasm: [],
    platformPatterns: [],
  };
}
