/**
 * 법률 / 로펌 도메인 정규화 사전
 * Legal Reputation, Social Proof Theory 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const LEGAL_SLANG: PatternRule[] = [
  { pattern: /유죄/g, replacement: '유죄 판결', description: 'canonical' },
  { pattern: /무죄/g, replacement: '무죄 판결', description: 'canonical' },
  { pattern: /집유/g, replacement: '집행유예', description: '약어 복원' },
  { pattern: /벌금형/g, replacement: '벌금 판결', description: 'canonical' },
  { pattern: /실형/g, replacement: '실형 선고', description: 'canonical' },
  { pattern: /전관예우/g, replacement: '전관 예우', description: '띄어쓰기 정규화' },
  { pattern: /무전유죄/g, replacement: '[사법불신]', description: '사법 신뢰 이슈 마킹' },
];

const LEGAL_OBFUSCATION: PatternRule[] = [];

const LEGAL_ENTITIES: EntityRule[] = [
  {
    canonical: '대법원',
    aliases: ['대법', '최고법원'],
    category: 'organization',
  },
  {
    canonical: '헌법재판소',
    aliases: ['헌재', '헌법재판소'],
    category: 'organization',
  },
  {
    canonical: '검찰청',
    aliases: ['검찰', '검찰조직'],
    category: 'organization',
  },
  {
    canonical: '김앤장',
    aliases: ['김앤장 법률사무소', '김&장'],
    category: 'organization',
  },
];

const LEGAL_SARCASM: SarcasmRule[] = [
  { pattern: /\b법\s*앞에\s*평등/g, marker: '[SARCASM?]', description: '사법 신뢰 반어 가능성' },
  { pattern: /유전무죄/g, marker: '[CRITICAL]', description: '사법 비판 마킹' },
];

const LEGAL_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /구속영장/g, replacement: '구속 영장', description: '띄어쓰기 정규화' },
  { pattern: /불구속/g, replacement: '불구속 수사', description: 'canonical' },
];

export const LEGAL_LEXICON: DomainLexicon = {
  domain: 'legal',
  slang: LEGAL_SLANG,
  obfuscation: LEGAL_OBFUSCATION,
  entities: LEGAL_ENTITIES,
  sarcasm: LEGAL_SARCASM,
  platformPatterns: LEGAL_PLATFORM_PATTERNS,
};
