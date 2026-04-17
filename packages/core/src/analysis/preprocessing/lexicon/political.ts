/**
 * 정치 도메인 정규화 사전
 * 한국 온라인 정치 담론에서 반복되는 은어, 야민정음, 반어, 개체명을 표준화한다.
 *
 * 주의: 특정 인물/정당에 대한 표현이 포함되나, 이는 여론 분석을 위한
 * 식별·정규화 목적이며 가치 판단이 아니다. 추가/수정은 PR로 리뷰 후 반영.
 */
import type { DomainLexicon, EntityRule, PatternRule, SarcasmRule } from './types';

/** 정치 커뮤니티 은어/야민정음
 * 주의: 한글은 정규식 \b 단어 경계가 동작하지 않으므로 (?![가-힣])로 한글 후방 단언을 사용한다.
 */
const POLITICAL_SLANG: PatternRule[] = [
  { pattern: /ㅇㅈ(?![가-힣])/g, replacement: '인정', description: '인정 축약' },
  { pattern: /ㄴㄴ(?![가-힣])/g, replacement: '노노', description: '부정 축약' },
  { pattern: /(?<![가-힣])ㅇㅇ(?![가-힣])/g, replacement: '응응', description: '긍정 축약' },
  { pattern: /ㄹㅇ(?![가-힣])/g, replacement: '레알', description: '진짜 축약' },
  { pattern: /(?<![가-힣])ㅂㅅ(?![가-힣])/g, replacement: '병신', description: '욕설 복원' },
  { pattern: /(?<![가-힣])ㅅㅂ(?![가-힣])/g, replacement: '시발', description: '욕설 복원' },
  { pattern: /(?<![가-힣])ㅈㄴ(?![가-힣])/g, replacement: '존나', description: '강조어 복원' },
  { pattern: /ㄱㅅ(?![가-힣])/g, replacement: '감사', description: '감사 축약' },
  { pattern: /ㅊㅋ(?![가-힣])/g, replacement: '축하', description: '축하 축약' },
  { pattern: /댕댕이/g, replacement: '멍멍이', description: '야민정음 복원' },
  { pattern: /띵작/g, replacement: '명작', description: '야민정음 복원' },
  { pattern: /커엽/g, replacement: '귀엽', description: '야민정음 복원' },
  { pattern: /롬곡옾눞/g, replacement: '폭풍눈물', description: '야민정음 복원' },
];

/** 정치 우회/비속어 (분석 품질을 위해 복원) */
const POLITICAL_OBFUSCATION: PatternRule[] = [
  { pattern: /문ㅈㅇ/g, replacement: '문재인', description: '자모분리 우회' },
  { pattern: /윤ㅅㅇ/g, replacement: '윤석열', description: '자모분리 우회' },
  { pattern: /이ㅈㅁ/g, replacement: '이재명', description: '자모분리 우회' },
  { pattern: /한ㄷㅎ/g, replacement: '한동훈', description: '자모분리 우회' },
  { pattern: /\b문(재|제)앙\b/g, replacement: '문재인', description: '조롱표현 → canonical' },
  { pattern: /\b이(재|제)앙\b/g, replacement: '이재명', description: '조롱표현 → canonical' },
];

/** 정치 개체명 통합 (canonical ↔ alias) */
const POLITICAL_ENTITIES: EntityRule[] = [
  {
    canonical: '한동훈',
    aliases: [
      '한 장관',
      '한장관',
      '한 전장관',
      '한 검',
      '한검',
      '한비어천가',
      '한동후니',
      '동훈이',
    ],
    category: 'person',
  },
  {
    canonical: '이재명',
    aliases: ['이 대표', '이대표', '이 지사', '이지사', '재명이', '명박이(이재명)', '대장동'],
    category: 'person',
  },
  {
    canonical: '윤석열',
    aliases: ['윤 대통령', '윤대통령', '윤통', '윤 검', '윤검', '석열이', '굥', '굥석열'],
    category: 'person',
  },
  {
    canonical: '문재인',
    aliases: ['문 대통령', '문대통령', '문통', '문 전대통령', '재인이'],
    category: 'person',
  },
  {
    canonical: '국민의힘',
    aliases: ['국힘', '힘당', '여당', '보수당', '국민의당(국힘)'],
    category: 'party',
  },
  {
    canonical: '더불어민주당',
    aliases: ['민주당', '더민주', '야당', '진보당(더민주)'],
    category: 'party',
  },
  {
    canonical: '조국혁신당',
    aliases: ['혁신당', '조국당', '조국신당'],
    category: 'party',
  },
];

/** 정치 반어/조롱 마킹 (감정 역전 방지) */
const POLITICAL_SARCASM: SarcasmRule[] = [
  {
    pattern: /참\s*잘\s*(했|났|하)/g,
    marker: '[SARCASM]',
    description: '반어: 참 잘~',
  },
  {
    pattern: /대\s*단\s*하\s*(네|십|시)/g,
    marker: '[SARCASM]',
    description: '반어: 대단하네',
  },
  {
    pattern: /역\s*시|과\s*연\s*님/g,
    marker: '[SARCASM]',
    description: '반어: 역시/과연님',
  },
  {
    pattern: /\b존경|우러러|찬양/g,
    marker: '[SARCASM?]',
    description: '잠재적 반어 (문맥 의존)',
  },
  {
    pattern: /\b\w+께서는\s*(또|다시|오늘도)/g,
    marker: '[SARCASM]',
    description: '반어: ~께서는 또/다시',
  },
];

/** 플랫폼별 특수 패턴 (정치) */
const POLITICAL_PLATFORM_PATTERNS: PatternRule[] = [
  { pattern: /짤방|짤/g, replacement: '이미지', description: 'DC 은어' },
  { pattern: /좌좀|좌빨/g, replacement: '[진보비하]', description: '정치 혐오 표현 마킹' },
  { pattern: /수꼴|극우/g, replacement: '[보수비하]', description: '정치 혐오 표현 마킹' },
  { pattern: /개딸|개딸단/g, replacement: '이재명 지지층', description: '별칭 정규화' },
  { pattern: /굥빠|윤빠/g, replacement: '윤석열 지지층', description: '별칭 정규화' },
];

export const POLITICAL_LEXICON: DomainLexicon = {
  domain: 'political',
  slang: POLITICAL_SLANG,
  obfuscation: POLITICAL_OBFUSCATION,
  entities: POLITICAL_ENTITIES,
  sarcasm: POLITICAL_SARCASM,
  platformPatterns: POLITICAL_PLATFORM_PATTERNS,
};
