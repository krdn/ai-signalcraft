/**
 * 공통 텍스트 정규화 규칙 (도메인 무관)
 * URL, 멘션, HTML 엔티티, 과도한 구두점, 한글 자모 등 표면 정규화.
 */
import type { PatternRule } from './types';

/** URL → [URL] 토큰화 (토큰 절감 + 링크 편향 제거) */
export const URL_RULES: PatternRule[] = [
  {
    pattern: /https?:\/\/[^\s<>"]+/gi,
    replacement: '[URL]',
    description: 'HTTP/HTTPS URL 토큰화',
  },
  {
    pattern: /www\.[^\s<>"]+/gi,
    replacement: '[URL]',
    description: 'www URL 토큰화',
  },
];

/** 멘션/해시태그 토큰화 */
export const MENTION_RULES: PatternRule[] = [
  {
    pattern: /@[\w가-힣]+/g,
    replacement: '[USER]',
    description: '멘션 토큰화',
  },
];

/** HTML 엔티티 복원 */
export const HTML_ENTITY_RULES: PatternRule[] = [
  { pattern: /&nbsp;/g, replacement: ' ', description: 'non-breaking space' },
  { pattern: /&lt;/g, replacement: '<', description: 'less-than' },
  { pattern: /&gt;/g, replacement: '>', description: 'greater-than' },
  { pattern: /&amp;/g, replacement: '&', description: 'ampersand' },
  { pattern: /&quot;/g, replacement: '"', description: 'quote' },
  { pattern: /&#39;/g, replacement: "'", description: 'apostrophe' },
];

/** 구두점/공백 정규화 */
export const PUNCTUATION_RULES: PatternRule[] = [
  {
    pattern: /!{2,}/g,
    replacement: '!',
    description: '반복 느낌표 축소',
  },
  {
    pattern: /\?{2,}/g,
    replacement: '?',
    description: '반복 물음표 축소',
  },
  {
    pattern: /\.{3,}/g,
    replacement: '…',
    description: '말줄임표 통일',
  },
  {
    pattern: /ㅋ{3,}/g,
    replacement: 'ㅋㅋ',
    description: 'ㅋ 반복 축소 (감정 보존 최소 단위)',
  },
  {
    pattern: /ㅎ{3,}/g,
    replacement: 'ㅎㅎ',
    description: 'ㅎ 반복 축소',
  },
  {
    pattern: /ㅠ{3,}/g,
    replacement: 'ㅠㅠ',
    description: 'ㅠ 반복 축소',
  },
  {
    pattern: /[\u{1F300}-\u{1F9FF}]/gu,
    replacement: '',
    description: '이모지 제거 (토큰 절감)',
  },
];

/** 공백 정규화 */
export const WHITESPACE_RULES: PatternRule[] = [
  { pattern: /[\t\r\v\f]+/g, replacement: ' ', description: '탭/캐리지리턴 → 공백' },
  { pattern: /\n{3,}/g, replacement: '\n\n', description: '과도한 줄바꿈 축소' },
  { pattern: / {2,}/g, replacement: ' ', description: '연속 공백 축소' },
];

/** 공통 규칙 전체 (적용 순서 중요) */
export const COMMON_RULES: PatternRule[] = [
  ...HTML_ENTITY_RULES,
  ...URL_RULES,
  ...MENTION_RULES,
  ...PUNCTUATION_RULES,
  ...WHITESPACE_RULES,
];
