/**
 * 도메인 특화 텍스트 정규화 엔진
 *
 * 파이프라인:
 *   1. 유니코드 NFC 정규화 (자모 결합)
 *   2. 공통 규칙 (URL, HTML 엔티티, 구두점, 공백)
 *   3. 도메인별 우회/은어 복원
 *   4. 도메인별 은어 → 표준어 치환
 *   5. 도메인별 플랫폼 특수 패턴
 *   6. 반어/조롱 마킹
 *   7. 개체명 통합 (canonical 이름으로 정규화)
 *
 * 성능 최적화:
 *   - 도메인별 alias → canonical 매핑을 단일 alternation regex로 precompile
 *   - lexicon 단위 캐시 (WeakMap) — 반복 호출 시 regex 재컴파일 방지
 */
import type { AnalysisDomain } from '../domain/types';
import type { AnalysisInput } from '../types';
import { COMMON_RULES } from './lexicon/common';
import { getDomainLexicon } from './lexicon/registry';
import type { DomainLexicon, PatternRule, SarcasmRule } from './lexicon/types';

export interface NormalizationStats {
  domain: AnalysisDomain | 'default';
  articlesProcessed: number;
  commentsProcessed: number;
  totalMatches: number;
  elapsedMs: number;
}

interface CompiledLexicon {
  entitiesRegex: RegExp | null;
  aliasToCanonical: Map<string, string>;
}

const compiledCache = new WeakMap<DomainLexicon, CompiledLexicon>();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileLexicon(lexicon: DomainLexicon): CompiledLexicon {
  const cached = compiledCache.get(lexicon);
  if (cached) return cached;

  const aliasToCanonical = new Map<string, string>();
  const allAliases: string[] = [];
  for (const entity of lexicon.entities) {
    for (const alias of entity.aliases) {
      aliasToCanonical.set(alias, entity.canonical);
      allAliases.push(alias);
    }
  }

  // 길이 긴 것부터 매칭 (예: "한 전장관"이 "한 장관"보다 먼저)
  allAliases.sort((a, b) => b.length - a.length);

  const entitiesRegex =
    allAliases.length > 0 ? new RegExp(allAliases.map(escapeRegex).join('|'), 'g') : null;

  const compiled: CompiledLexicon = { entitiesRegex, aliasToCanonical };
  compiledCache.set(lexicon, compiled);
  return compiled;
}

function applyPatternRules(
  text: string,
  rules: readonly PatternRule[],
): { text: string; matches: number } {
  let out = text;
  let matches = 0;
  for (const rule of rules) {
    const before = out;
    out = out.replace(rule.pattern, rule.replacement);
    if (before !== out) matches++;
  }
  return { text: out, matches };
}

function applySarcasmRules(
  text: string,
  rules: readonly SarcasmRule[],
): { text: string; matches: number } {
  let out = text;
  let matches = 0;
  for (const rule of rules) {
    const marker = rule.marker ?? '[SARCASM]';
    const before = out;
    out = out.replace(rule.pattern, (m) => `${m} ${marker}`);
    if (before !== out) matches++;
  }
  return { text: out, matches };
}

/** 개별 문자열 정규화 */
export function normalizeText(
  text: string | null | undefined,
  lexicon: DomainLexicon,
): { text: string; matchCount: number } {
  if (!text) return { text: '', matchCount: 0 };

  const { entitiesRegex, aliasToCanonical } = compileLexicon(lexicon);

  let result = text.normalize('NFC');
  let matchCount = 0;

  const common = applyPatternRules(result, COMMON_RULES);
  result = common.text;
  matchCount += common.matches;

  const obfuscation = applyPatternRules(result, lexicon.obfuscation);
  result = obfuscation.text;
  matchCount += obfuscation.matches;

  const slang = applyPatternRules(result, lexicon.slang);
  result = slang.text;
  matchCount += slang.matches;

  const platform = applyPatternRules(result, lexicon.platformPatterns ?? []);
  result = platform.text;
  matchCount += platform.matches;

  const sarcasm = applySarcasmRules(result, lexicon.sarcasm);
  result = sarcasm.text;
  matchCount += sarcasm.matches;

  // 개체명: 단일 alternation regex로 한 번에 치환
  if (entitiesRegex) {
    const before = result;
    result = result.replace(entitiesRegex, (m) => aliasToCanonical.get(m) ?? m);
    if (before !== result) matchCount++;
  }

  return { text: result.trim(), matchCount };
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
