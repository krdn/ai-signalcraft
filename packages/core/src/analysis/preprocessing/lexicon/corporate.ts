/**
 * 기업 평판 관리 도메인 정규화 사전
 * RepTrak, Stakeholder Theory 기반.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const CORPORATE_SLANG: PatternRule[] = [
  { pattern: /갑질/g, replacement: '권력남용', description: '기업 이슈 용어' },
  { pattern: /오너리스크/g, replacement: '오너 리스크', description: '띄어쓰기 정규화' },
  { pattern: /주가조작/g, replacement: '주가 조작', description: '띄어쓰기 정규화' },
  { pattern: /분식회계/g, replacement: '분식 회계', description: '띄어쓰기 정규화' },
  { pattern: /상폐/g, replacement: '상장폐지', description: '약어 복원' },
  { pattern: /임단협/g, replacement: '임금단체협상', description: '약어 복원' },
  { pattern: /노조/g, replacement: '노동조합', description: 'canonical' },
];

const CORPORATE_OBFUSCATION: PatternRule[] = [
  { pattern: /삼\s*성/g, replacement: '삼성', description: '띄어쓰기 우회 복원' },
  { pattern: /\bS\s*K\b/g, replacement: 'SK', description: '띄어쓰기 우회 복원' },
];

const CORPORATE_ENTITIES: EntityRule[] = [
  {
    canonical: '삼성전자',
    aliases: ['삼전', '삼성', 'Samsung Electronics'],
    category: 'organization',
  },
  {
    canonical: 'SK하이닉스',
    aliases: ['하이닉스', 'SK Hynix'],
    category: 'organization',
  },
  {
    canonical: 'LG전자',
    aliases: ['LGE', 'LG Electronics'],
    category: 'organization',
  },
  {
    canonical: '현대자동차',
    aliases: ['현대차', '현차', 'Hyundai Motor'],
    category: 'organization',
  },
  {
    canonical: 'ESG',
    aliases: ['ESG경영', '지속가능경영', '이에스지'],
    category: 'issue',
  },
];

const CORPORATE_SARCASM: SarcasmRule[] = [
  { pattern: /\b역시\s*대기업/g, marker: '[SARCASM]', description: '반어 조롱' },
  { pattern: /\b착한\s*기업/g, marker: '[SARCASM?]', description: '문맥 의존 반어' },
];

const CORPORATE_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /존버/g, replacement: '장기 보유', description: '투자 은어' },
  { pattern: /손절/g, replacement: '손실 매도', description: '투자 은어' },
  { pattern: /떡락/g, replacement: '급락', description: '주가 은어' },
  { pattern: /떡상/g, replacement: '급등', description: '주가 은어' },
];

export const CORPORATE_LEXICON: DomainLexicon = {
  domain: 'corporate',
  slang: CORPORATE_SLANG,
  obfuscation: CORPORATE_OBFUSCATION,
  entities: CORPORATE_ENTITIES,
  sarcasm: CORPORATE_SARCASM,
  platformPatterns: CORPORATE_PLATFORM_PATTERNS,
};
