/**
 * 금융 / 투자 리서치 도메인 정규화 사전
 * Behavioral Finance, Information Cascade 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const FINANCE_SLANG: PatternRule[] = [
  { pattern: /존버/g, replacement: '장기 보유', description: '투자 은어' },
  { pattern: /떡상/g, replacement: '급등', description: '주가 은어' },
  { pattern: /떡락/g, replacement: '급락', description: '주가 은어' },
  { pattern: /개미/g, replacement: '개인 투자자', description: '투자 은어' },
  { pattern: /기관/g, replacement: '기관 투자자', description: 'canonical (문맥)' },
  { pattern: /외인/g, replacement: '외국인 투자자', description: '약어 복원' },
  { pattern: /줍줍/g, replacement: '저가 매수', description: '투자 은어' },
  { pattern: /물렸다/g, replacement: '손실 중', description: '투자 은어' },
  { pattern: /물렸어/g, replacement: '손실 중', description: '투자 은어' },
  { pattern: /익절/g, replacement: '이익 실현', description: '투자 용어' },
  { pattern: /손절/g, replacement: '손실 매도', description: '투자 용어' },
  { pattern: /단타/g, replacement: '단기 매매', description: '투자 은어' },
  { pattern: /장투/g, replacement: '장기 투자', description: '투자 은어' },
  { pattern: /불장/g, replacement: '상승장', description: '투자 은어' },
  { pattern: /약세장/g, replacement: '하락장', description: 'canonical' },
];

const FINANCE_OBFUSCATION: PatternRule[] = [
  { pattern: /코\s*인/g, replacement: '코인', description: '암호화폐 복원' },
];

const FINANCE_ENTITIES: EntityRule[] = [
  {
    canonical: '코스피',
    aliases: ['KOSPI', '코스피지수', '종합주가지수'],
    category: 'issue',
  },
  {
    canonical: '코스닥',
    aliases: ['KOSDAQ', '코스닥지수'],
    category: 'issue',
  },
  {
    canonical: '비트코인',
    aliases: ['BTC', '비트', 'bitcoin'],
    category: 'issue',
  },
  {
    canonical: '금리',
    aliases: ['기준금리', '정책금리', '한은 기준금리'],
    category: 'issue',
  },
];

const FINANCE_SARCASM: SarcasmRule[] = [
  { pattern: /\b감사합니다\s*기관님/g, marker: '[SARCASM]', description: '기관 매도 조롱' },
  { pattern: /\b역시\s*한국\s*증시/g, marker: '[SARCASM]', description: '증시 조롱' },
];

const FINANCE_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /테마주/g, replacement: '테마 종목', description: 'canonical' },
  { pattern: /작전주/g, replacement: '시세 조종 의심 종목', description: 'canonical' },
];

export const FINANCE_LEXICON: DomainLexicon = {
  domain: 'finance',
  slang: FINANCE_SLANG,
  obfuscation: FINANCE_OBFUSCATION,
  entities: FINANCE_ENTITIES,
  sarcasm: FINANCE_SARCASM,
  platformPatterns: FINANCE_PLATFORM_PATTERNS,
};
