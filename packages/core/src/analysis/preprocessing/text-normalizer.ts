/**
 * 도메인 특화 텍스트 정규화 엔진
 *
 * 입력된 텍스트에 대해 다음 단계로 정규화를 수행한다:
 *   1. 유니코드 NFC 정규화 (자모 결합)
 *   2. 공통 규칙 (URL, HTML 엔티티, 구두점, 공백)
 *   3. 도메인별 우회/은어 복원
 *   4. 도메인별 은어 → 표준어 치환
 *   5. 도메인별 플랫폼 특수 패턴
 *   6. 반어/조롱 마킹
 *   7. 개체명 통합 (canonical 이름으로 정규화)
 *
 * 성능 목표: 건당 5ms 이하 (20ms 내 완료 가능한 규모)
 */
import type { AnalysisDomain } from '../domain/types';
import type { AnalysisInput } from '../types';
import { COMMON_RULES } from './lexicon/common';
import { getDomainLexicon } from './lexicon/registry';
import type { DomainLexicon, PatternRule, SarcasmRule } from './lexicon/types';

export interface NormalizationStats {
  /** 도메인 */
  domain: AnalysisDomain | 'default';
  /** 처리된 기사 개수 */
  articlesProcessed: number;
  /** 처리된 댓글 개수 */
  commentsProcessed: number;
  /** 적용된 규칙 총 매칭 횟수 */
  totalMatches: number;
  /** 처리 시간 (ms) */
  elapsedMs: number;
}

/** 개별 문자열 정규화 */
export function normalizeText(
  text: string | null | undefined,
  lexicon: DomainLexicon,
): { text: string; matchCount: number } {
  if (!text) return { text: '', matchCount: 0 };

  let result = text;
  let matchCount = 0;

  // 1. 유니코드 NFC 정규화 (한글 자모 결합)
  result = result.normalize('NFC');

  // 2. 공통 표면 정규화 (HTML 엔티티, URL, 구두점, 공백)
  for (const rule of COMMON_RULES) {
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    if (before !== result) matchCount++;
  }

  // 3. 우회 표현 복원 (자모분리, 띄어쓰기 우회)
  for (const rule of lexicon.obfuscation) {
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    if (before !== result) matchCount++;
  }

  // 4. 은어 → 표준어
  for (const rule of lexicon.slang) {
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    if (before !== result) matchCount++;
  }

  // 5. 플랫폼별 특수 패턴
  for (const rule of lexicon.platformPatterns ?? []) {
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    if (before !== result) matchCount++;
  }

  // 6. 반어/조롱 마킹 (치환이 아닌 태그 부착)
  for (const rule of lexicon.sarcasm) {
    const marker = rule.marker ?? '[SARCASM]';
    const before = result;
    result = result.replace(rule.pattern, (match) => `${match} ${marker}`);
    if (before !== result) matchCount++;
  }

  // 7. 개체명 통합 (alias → canonical)
  for (const entity of lexicon.entities) {
    for (const alias of entity.aliases) {
      // 정확 매칭을 위해 alias를 escape 후 단어 경계 적용
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const aliasPattern = new RegExp(escaped, 'g');
      const before = result;
      result = result.replace(aliasPattern, entity.canonical);
      if (before !== result) matchCount++;
    }
  }

  // 최종 공백 트림
  result = result.trim();

  return { text: result, matchCount };
}

/** AnalysisInput 전체에 도메인 정규화 적용 */
export function normalizeAnalysisInput(
  input: AnalysisInput,
  domain: AnalysisDomain | undefined,
): { input: AnalysisInput; stats: NormalizationStats } {
  const startedAt = Date.now();
  const lexicon = getDomainLexicon(domain);
  let totalMatches = 0;

  const articles = input.articles.map((article) => {
    const titleResult = normalizeText(article.title, lexicon);
    const contentResult = normalizeText(article.content, lexicon);
    totalMatches += titleResult.matchCount + contentResult.matchCount;
    return {
      ...article,
      title: titleResult.text,
      content: contentResult.text || null,
    };
  });

  const comments = input.comments.map((comment) => {
    const result = normalizeText(comment.content, lexicon);
    totalMatches += result.matchCount;
    return { ...comment, content: result.text };
  });

  const videos = input.videos.map((video) => {
    const titleResult = normalizeText(video.title, lexicon);
    const descResult = normalizeText(video.description, lexicon);
    totalMatches += titleResult.matchCount + descResult.matchCount;
    return {
      ...video,
      title: titleResult.text,
      description: descResult.text || null,
    };
  });

  const elapsedMs = Date.now() - startedAt;

  return {
    input: { ...input, articles, comments, videos },
    stats: {
      domain: domain ?? 'default',
      articlesProcessed: articles.length,
      commentsProcessed: comments.length,
      totalMatches,
      elapsedMs,
    },
  };
}

/** 디버깅용: 단일 문자열에 특정 도메인 정규화 적용 */
export function normalizeWithDomain(text: string, domain: AnalysisDomain | undefined): string {
  const lexicon = getDomainLexicon(domain);
  return normalizeText(text, lexicon).text;
}

// Private export for testing
export { _applyRulesForTest as _applyRules };
function _applyRulesForTest(text: string, rules: PatternRule[] | SarcasmRule[]): string {
  let out = text;
  for (const rule of rules) {
    if ('replacement' in rule) {
      out = out.replace(rule.pattern, rule.replacement);
    } else {
      const marker = rule.marker ?? '[SARCASM]';
      out = out.replace(rule.pattern, (m) => `${m} ${marker}`);
    }
  }
  return out;
}
