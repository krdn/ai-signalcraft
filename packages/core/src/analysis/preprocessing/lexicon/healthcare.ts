/**
 * 제약 / 헬스케어 도메인 정규화 사전
 * Health Belief Model, Risk Perception 이론 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const HEALTHCARE_SLANG: PatternRule[] = [
  { pattern: /부작용/g, replacement: '이상반응', description: '의학적 canonical' },
  { pattern: /만병통치약/g, replacement: '[과장표현]', description: '신뢰성 경고' },
  { pattern: /명약/g, replacement: '효능 있는 약', description: '과장 완화' },
  { pattern: /기적의\s*약/g, replacement: '[과장표현]', description: '신뢰성 경고' },
];

const HEALTHCARE_OBFUSCATION: PatternRule[] = [
  { pattern: /코\s*로\s*나/g, replacement: '코로나', description: '띄어쓰기 복원' },
];

const HEALTHCARE_ENTITIES: EntityRule[] = [
  {
    canonical: '식품의약품안전처',
    aliases: ['식약처', '식약청', 'MFDS'],
    category: 'organization',
  },
  {
    canonical: '건강보험심사평가원',
    aliases: ['심평원', 'HIRA'],
    category: 'organization',
  },
  {
    canonical: '국민건강보험공단',
    aliases: ['건보공단', '건강보험공단', 'NHIS'],
    category: 'organization',
  },
  {
    canonical: '코로나19',
    aliases: ['코로나', 'COVID', 'COVID-19', '우한폐렴'],
    category: 'issue',
  },
  {
    canonical: '백신 부작용',
    aliases: ['백신이상반응', '백신 이상반응', 'VAERS 이슈'],
    category: 'issue',
  },
];

const HEALTHCARE_SARCASM: SarcasmRule[] = [
  { pattern: /\b안전하다고\s*했잖/g, marker: '[DISTRUST]', description: '불신 표현' },
  { pattern: /\b믿을\s*만\s*하네/g, marker: '[SARCASM?]', description: '문맥 의존 반어' },
];

const HEALTHCARE_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /약빨/g, replacement: '약효', description: '은어 복원' },
  { pattern: /돌팔이/g, replacement: '[의료불신]', description: '신뢰도 마킹' },
];

export const HEALTHCARE_LEXICON: DomainLexicon = {
  domain: 'healthcare',
  slang: HEALTHCARE_SLANG,
  obfuscation: HEALTHCARE_OBFUSCATION,
  entities: HEALTHCARE_ENTITIES,
  sarcasm: HEALTHCARE_SARCASM,
  platformPatterns: HEALTHCARE_PLATFORM_PATTERNS,
};
