/**
 * 대학 / 교육기관 도메인 정규화 사전
 * Institutional Reputation, Signaling Theory 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const EDUCATION_SLANG: PatternRule[] = [
  { pattern: /수능/g, replacement: '대학수학능력시험', description: '공식 명칭' },
  { pattern: /정시/g, replacement: '정시 모집', description: 'canonical' },
  { pattern: /수시/g, replacement: '수시 모집', description: 'canonical' },
  { pattern: /내신/g, replacement: '학생부 성적', description: 'canonical' },
  { pattern: /킬러\s*문항/g, replacement: '고난도 문항', description: 'canonical' },
  { pattern: /스카이/g, replacement: 'SKY 대학', description: 'canonical' },
  { pattern: /인서울/g, replacement: '서울 소재 대학', description: 'canonical' },
  { pattern: /지잡대/g, replacement: '[지방대비하]', description: '혐오표현 마킹' },
];

const EDUCATION_OBFUSCATION: PatternRule[] = [];

const EDUCATION_ENTITIES: EntityRule[] = [
  {
    canonical: '교육부',
    aliases: ['교육부처', '교육인적자원부'],
    category: 'organization',
  },
  {
    canonical: '한국교육과정평가원',
    aliases: ['평가원', '교평원', 'KICE'],
    category: 'organization',
  },
  {
    canonical: '의대 증원',
    aliases: ['의대증원', '의과대학 증원', '의사 증원'],
    category: 'issue',
  },
  {
    canonical: '자사고',
    aliases: ['자율형사립고', '자율형 사립고', '자사고 폐지'],
    category: 'issue',
  },
];

const EDUCATION_SARCASM: SarcasmRule[] = [
  { pattern: /\b공교육\s*정상화/g, marker: '[SARCASM?]', description: '정책 조롱 가능성' },
  { pattern: /\b사교육\s*없는/g, marker: '[SARCASM?]', description: '현실 괴리 풍자' },
];

const EDUCATION_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /학폭/g, replacement: '학교폭력', description: '약어 복원' },
  { pattern: /교권/g, replacement: '교권 침해', description: '문맥 확장' },
];

export const EDUCATION_LEXICON: DomainLexicon = {
  domain: 'education',
  slang: EDUCATION_SLANG,
  obfuscation: EDUCATION_OBFUSCATION,
  entities: EDUCATION_ENTITIES,
  sarcasm: EDUCATION_SARCASM,
  platformPatterns: EDUCATION_PLATFORM_PATTERNS,
};
