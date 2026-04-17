/**
 * 정책 연구 / 싱크탱크 도메인 정규화 사전
 * ACF, Punctuated Equilibrium, Policy Feedback 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const POLICY_SLANG: PatternRule[] = [
  { pattern: /탁상공론/g, replacement: '현실성 없는 정책', description: '정책 비판 용어' },
  { pattern: /삽질/g, replacement: '비효율적 행정', description: '행정 비판 은어' },
  { pattern: /포퓰리즘/g, replacement: '대중영합주의', description: 'canonical' },
  { pattern: /전시행정/g, replacement: '전시성 행정', description: '행정 비판 용어' },
];

const POLICY_OBFUSCATION: PatternRule[] = [];

const POLICY_ENTITIES: EntityRule[] = [
  {
    canonical: '국토교통부',
    aliases: ['국토부', '국교부'],
    category: 'organization',
  },
  {
    canonical: '기획재정부',
    aliases: ['기재부'],
    category: 'organization',
  },
  {
    canonical: '보건복지부',
    aliases: ['복지부'],
    category: 'organization',
  },
  {
    canonical: '부동산 정책',
    aliases: ['부동산정책', '주택정책', '주거정책'],
    category: 'issue',
  },
  {
    canonical: '연금 개혁',
    aliases: ['국민연금 개혁', '연금개혁', '연금 개혁안'],
    category: 'issue',
  },
];

const POLICY_SARCASM: SarcasmRule[] = [
  { pattern: /\b또\s*다른\s*탁상/g, marker: '[SARCASM]', description: '정책 조롱' },
  { pattern: /\b전형적인\s*현실\s*외면/g, marker: '[CRITICAL]', description: '비판 마킹' },
];

const POLICY_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /공론화/g, replacement: '공론 형성', description: 'canonical' },
];

export const POLICY_LEXICON: DomainLexicon = {
  domain: 'policy',
  slang: POLICY_SLANG,
  obfuscation: POLICY_OBFUSCATION,
  entities: POLICY_ENTITIES,
  sarcasm: POLICY_SARCASM,
  platformPatterns: POLICY_PLATFORM_PATTERNS,
};
