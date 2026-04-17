/**
 * 프랜차이즈 / 유통 도메인 정규화 사전
 * CBBE Model, Franchise System Dynamics 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const RETAIL_SLANG: PatternRule[] = [
  { pattern: /갓성비/g, replacement: '가성비 우수', description: '소비자 은어' },
  { pattern: /불매운동/g, replacement: '불매 운동', description: '띄어쓰기 정규화' },
  { pattern: /리콜/g, replacement: '제품 회수', description: 'canonical' },
  { pattern: /본사갑질/g, replacement: '본사 갑질', description: '띄어쓰기 정규화' },
  { pattern: /가맹점주/g, replacement: '가맹점 점주', description: 'canonical' },
  { pattern: /점주/g, replacement: '가맹점 점주', description: 'canonical (문맥)' },
  { pattern: /인테리어강요/g, replacement: '인테리어 강요', description: '띄어쓰기 정규화' },
];

const RETAIL_OBFUSCATION: PatternRule[] = [];

const RETAIL_ENTITIES: EntityRule[] = [
  {
    canonical: '공정거래위원회',
    aliases: ['공정위', 'KFTC'],
    category: 'organization',
  },
  {
    canonical: '본사-가맹점 분쟁',
    aliases: ['가맹본부 분쟁', '본사 가맹 갈등', '본사-점주 분쟁'],
    category: 'issue',
  },
];

const RETAIL_SARCASM: SarcasmRule[] = [
  { pattern: /착한\s*기업/g, marker: '[SARCASM?]', description: '착한기업 반어 가능성' },
  { pattern: /\b역시\s*본사/g, marker: '[SARCASM]', description: '본사 조롱' },
];

const RETAIL_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /최저가/g, replacement: '최저가 경쟁', description: 'canonical' },
  { pattern: /직영점/g, replacement: '직영 매장', description: 'canonical' },
];

export const RETAIL_LEXICON: DomainLexicon = {
  domain: 'retail',
  slang: RETAIL_SLANG,
  obfuscation: RETAIL_OBFUSCATION,
  entities: RETAIL_ENTITIES,
  sarcasm: RETAIL_SARCASM,
  platformPatterns: RETAIL_PLATFORM_PATTERNS,
};
