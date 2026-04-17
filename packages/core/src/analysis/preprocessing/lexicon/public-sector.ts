/**
 * 지자체 / 공공기관 도메인 정규화 사전
 * Participatory Governance, Public Trust 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const PUBLIC_SECTOR_SLANG: PatternRule[] = [
  { pattern: /민원/g, replacement: '주민 민원', description: 'canonical' },
  { pattern: /혈세/g, replacement: '세금', description: '과장 완화' },
  { pattern: /예산낭비/g, replacement: '예산 낭비', description: '띄어쓰기 정규화' },
  { pattern: /공무원연금/g, replacement: '공무원 연금', description: '띄어쓰기 정규화' },
];

const PUBLIC_SECTOR_OBFUSCATION: PatternRule[] = [];

const PUBLIC_SECTOR_ENTITIES: EntityRule[] = [
  {
    canonical: '서울특별시',
    aliases: ['서울시', '서울', '서울 시청'],
    category: 'organization',
  },
  {
    canonical: '경기도',
    aliases: ['경기도청', '경기'],
    category: 'organization',
  },
  {
    canonical: '재개발',
    aliases: ['재개발 사업', '도시 재개발', '뉴타운'],
    category: 'issue',
  },
  {
    canonical: '재건축',
    aliases: ['재건축 사업', '아파트 재건축'],
    category: 'issue',
  },
];

const PUBLIC_SECTOR_SARCASM: SarcasmRule[] = [
  { pattern: /\b일\s*잘\s*하시네/g, marker: '[SARCASM?]', description: '공공행정 반어' },
  { pattern: /\b세금\s*아깝다/g, marker: '[CRITICAL]', description: '예산 비판 마킹' },
];

const PUBLIC_SECTOR_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /공청회/g, replacement: '공청회 의견 수렴', description: 'canonical' },
];

export const PUBLIC_SECTOR_LEXICON: DomainLexicon = {
  domain: 'public-sector',
  slang: PUBLIC_SECTOR_SLANG,
  obfuscation: PUBLIC_SECTOR_OBFUSCATION,
  entities: PUBLIC_SECTOR_ENTITIES,
  sarcasm: PUBLIC_SECTOR_SARCASM,
  platformPatterns: PUBLIC_SECTOR_PLATFORM_PATTERNS,
};
