/**
 * 도메인 특화 정규화 사전 타입 정의
 * 분석 유형(정치/팬덤/PR 등)별로 은어·반어·개체명을 표준화하는 사전 구조.
 */
import type { AnalysisDomain } from '../../domain/types';

/** 정규식 치환 규칙 */
export interface PatternRule {
  /** 매칭 패턴 */
  pattern: RegExp;
  /** 치환 문자열 (또는 치환 함수) */
  replacement: string;
  /** 규칙 설명 (디버깅/로그용) */
  description?: string;
}

/** 개체명 정규화 규칙: 여러 별칭을 canonical 이름으로 통합 */
export interface EntityRule {
  /** 표준화된 이름 (예: "한동훈") */
  canonical: string;
  /** 별칭 목록 (예: ["한비어천가", "한장관", "한검"]) */
  aliases: string[];
  /** 카테고리 (person / party / organization / issue) */
  category: 'person' | 'party' | 'organization' | 'issue';
}

/** 반어/조롱 표현 마킹 규칙 */
export interface SarcasmRule {
  /** 반어 표현 패턴 */
  pattern: RegExp;
  /** 마킹 태그 (기본값: [SARCASM]) */
  marker?: string;
  /** 설명 */
  description?: string;
}

/** 도메인 사전 */
export interface DomainLexicon {
  /** 도메인 식별자 */
  domain: AnalysisDomain;
  /** 은어 → 표준어 치환 (정규식) */
  slang: PatternRule[];
  /** 야민정음/자모분리/우회표현 복원 */
  obfuscation: PatternRule[];
  /** 개체명 통합 */
  entities: EntityRule[];
  /** 반어/조롱 마킹 */
  sarcasm: SarcasmRule[];
  /** 플랫폼별 특수 패턴 (선택) */
  platformPatterns?: PatternRule[];
}
