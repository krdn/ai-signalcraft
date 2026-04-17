/**
 * 스포츠 / e스포츠 도메인 정규화 사전
 * BIRGing/CORFing, Sport Consumer Behavior 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const SPORTS_SLANG: PatternRule[] = [
  { pattern: /감독\s*경질/g, replacement: '감독 경질', description: 'canonical' },
  { pattern: /우승각/g, replacement: '우승 가능성', description: '은어' },
  { pattern: /광탈/g, replacement: '초반 탈락', description: '은어' },
  { pattern: /레전드/g, replacement: '전설급 선수', description: 'canonical' },
  { pattern: /먹튀/g, replacement: '기대 이하 성적', description: '은어' },
  { pattern: /대박/g, replacement: '큰 성공', description: '은어 완화' },
  { pattern: /\bGG\b/g, replacement: '패배 인정', description: 'e스포츠 은어' },
  { pattern: /캐리/g, replacement: '게임 주도', description: 'e스포츠 은어' },
  { pattern: /쓰로잉/g, replacement: '고의 패배', description: 'e스포츠 은어' },
];

const SPORTS_OBFUSCATION: PatternRule[] = [];

const SPORTS_ENTITIES: EntityRule[] = [
  {
    canonical: 'KBO 리그',
    aliases: ['KBO', '프로야구', '한국프로야구'],
    category: 'organization',
  },
  {
    canonical: 'K리그',
    aliases: ['K League', '프로축구', '한국프로축구'],
    category: 'organization',
  },
  {
    canonical: 'LCK',
    aliases: ['League of Legends Champions Korea', 'LoL 챔스', '롤챔스'],
    category: 'organization',
  },
];

const SPORTS_SARCASM: SarcasmRule[] = [
  { pattern: /\b역시\s*\w+\s*감독/g, marker: '[SARCASM?]', description: '감독 조롱 가능성' },
  { pattern: /\b또\s*졌(네|다)/g, marker: '[NEGATIVE]', description: '반복 패배 실망' },
];

const SPORTS_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /홈런타자/g, replacement: '홈런 타자', description: '띄어쓰기 정규화' },
  { pattern: /트레이드/g, replacement: '선수 트레이드', description: 'canonical' },
];

export const SPORTS_LEXICON: DomainLexicon = {
  domain: 'sports',
  slang: SPORTS_SLANG,
  obfuscation: SPORTS_OBFUSCATION,
  entities: SPORTS_ENTITIES,
  sarcasm: SPORTS_SARCASM,
  platformPatterns: SPORTS_PLATFORM_PATTERNS,
};
