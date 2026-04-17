/**
 * PR / 위기관리 도메인 정규화 사전
 * SCCT, Image Repair Theory 기반 위기 커뮤니케이션 분석용.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

const PR_SLANG: PatternRule[] = [
  { pattern: /언플/g, replacement: '언론 플레이', description: '언론 조작 은어' },
  { pattern: /여론몰이/g, replacement: '여론 조작', description: 'canonical 통일' },
  { pattern: /해명글/g, replacement: '공식 해명', description: 'PR 용어' },
  { pattern: /사과문/g, replacement: '공식 사과', description: 'PR 용어' },
  { pattern: /꼬리자르기/g, replacement: '책임 회피', description: '위기관리 은어' },
  { pattern: /물타기/g, replacement: '이슈 희석', description: 'PR 은어' },
  { pattern: /늦장대응/g, replacement: '지연된 대응', description: '위기관리 용어' },
];

const PR_OBFUSCATION: PatternRule[] = [
  { pattern: /사과\s*아닌\s*사과/g, replacement: '[비사과]', description: '반쪽 사과 마킹' },
];

const PR_ENTITIES: EntityRule[] = [
  {
    canonical: '공식입장',
    aliases: ['공식 입장문', '공식발표', '입장문', '공식 성명'],
    category: 'issue',
  },
  {
    canonical: '리콜',
    aliases: ['제품 회수', '자발적 회수', '리콜 조치'],
    category: 'issue',
  },
];

const PR_SARCASM: SarcasmRule[] = [
  { pattern: /심심한\s*사과/g, marker: '[SARCASM]', description: '어휘 오용 사례' },
  { pattern: /유감입니다/g, marker: '[WEAK_APOLOGY]', description: '약한 사과 표현' },
  { pattern: /\b오해가\s*있었/g, marker: '[DEFLECTION]', description: '책임 전가 신호' },
];

const PR_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /불매/g, replacement: '불매운동', description: 'canonical 통일' },
  { pattern: /손절/g, replacement: '관계 단절', description: 'PR 맥락' },
];

export const PR_LEXICON: DomainLexicon = {
  domain: 'pr',
  slang: PR_SLANG,
  obfuscation: PR_OBFUSCATION,
  entities: PR_ENTITIES,
  sarcasm: PR_SARCASM,
  platformPatterns: PR_PLATFORM_PATTERNS,
};
