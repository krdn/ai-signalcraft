/**
 * 팬덤 도메인 정규화 사전
 * K-pop, 셀럽, 엔터 팬덤 커뮤니티 은어를 표준화한다.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const FANDOM_SLANG: PatternRule[] = [
  { pattern: /덕질/g, replacement: '팬활동', description: '팬덤 용어' },
  { pattern: /입덕/g, replacement: '팬이 됨', description: '팬덤 용어' },
  { pattern: /탈덕/g, replacement: '팬을 그만둠', description: '팬덤 용어' },
  { pattern: /성덕/g, replacement: '성공한 팬', description: '팬덤 용어' },
  { pattern: /최애/g, replacement: '최고의 애정대상', description: '팬덤 용어' },
  { pattern: /차애/g, replacement: '두번째 애정대상', description: '팬덤 용어' },
  { pattern: /본진/g, replacement: '주요 팬덤', description: '팬덤 용어' },
  { pattern: /직캠/g, replacement: '직접 촬영 영상', description: '팬덤 용어' },
  { pattern: /찍덕/g, replacement: '촬영 팬', description: '팬덤 용어' },
  { pattern: /ㅇㅈ(?![가-힣])/g, replacement: '인정', description: '인정 축약' },
  { pattern: /ㄹㅇ(?![가-힣])/g, replacement: '레알', description: '진짜 축약' },
];

const FANDOM_OBFUSCATION: PatternRule[] = [
  { pattern: /어\s*그\s*로/g, replacement: '어그로', description: '띄어쓰기 복원' },
  { pattern: /악\s*개/g, replacement: '악플러', description: '팬덤 용어' },
];

const FANDOM_ENTITIES: EntityRule[] = [
  // 실제 운영 시 DB나 키워드 설정에서 동적으로 로드하는 것이 이상적
  // 여기서는 구조 예시만 제공 (추후 외부 데이터 소스와 연동)
];

const FANDOM_SARCASM: SarcasmRule[] = [
  {
    pattern: /역시|과연\s*우리/g,
    marker: '[SARCASM?]',
    description: '팬덤 내 반어 가능성',
  },
  {
    pattern: /어휴|하\s*참/g,
    marker: '[NEGATIVE]',
    description: '실망/체념 표현',
  },
];

const FANDOM_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /어그로꾼/g, replacement: '[관심종자]', description: '팬덤 비하 마킹' },
  { pattern: /안티/g, replacement: '[안티팬]', description: '정규화' },
];

export const FANDOM_LEXICON: DomainLexicon = {
  domain: 'fandom',
  slang: FANDOM_SLANG,
  obfuscation: FANDOM_OBFUSCATION,
  entities: FANDOM_ENTITIES,
  sarcasm: FANDOM_SARCASM,
  platformPatterns: FANDOM_PLATFORM_PATTERNS,
};
