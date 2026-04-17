/**
 * MinHash + Locality Sensitive Hashing (LSH)
 *
 * 목적: O(N²) 쌍별 유사도 비교를 O(N log N)로 낮춰 대규모 중복 제거 가속.
 * 원리:
 *   1. 각 문서를 n-gram shingle 집합으로 변환
 *   2. K개의 해시 함수로 MinHash signature 생성 (k-dim 벡터)
 *   3. signature를 B개 band로 분할, 각 band를 해시 버킷 키로 사용
 *   4. 같은 버킷에 들어간 문서 쌍만 실제 유사도 비교 (Jaccard 근사)
 *
 * 임베딩 dedup과의 차이:
 *   - 임베딩 dedup: 의미적으로 유사한 기사 (구조 다른 동일 주제)
 *   - LSH dedup: 문자열적으로 거의 동일한 기사 (약간의 편집/복붙)
 *
 * 두 방법을 조합 시:
 *   LSH (O(N log N), 빠름, 표면 유사) → 임베딩 dedup (O(M²), 의미 유사)
 *   LSH가 M개로 줄여주면 임베딩 비교는 M²로 감소
 */
import { createHash } from 'node:crypto';
import type { AnalysisInput } from '../types';

/** 문자 n-gram shingle 추출 */
function shingle(text: string, n = 5): Set<string> {
  const normalized = text.replace(/\s+/g, ' ').toLowerCase().trim();
  const shingles = new Set<string>();
  if (normalized.length < n) {
    shingles.add(normalized);
    return shingles;
  }
  for (let i = 0; i <= normalized.length - n; i++) {
    shingles.add(normalized.slice(i, i + n));
  }
  return shingles;
}

/** 문자열의 32-bit 해시 (FNV-1a) */
function fnv1a(str: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/**
 * K개 해시 함수를 적용해 MinHash signature 생성.
 * signature[k] = min over shingles of hash_k(shingle)
 */
function minHashSignature(shingles: Set<string>, k: number, seeds: number[]): Uint32Array {
  const sig = new Uint32Array(k).fill(0xffffffff);
  for (const s of shingles) {
    for (let i = 0; i < k; i++) {
      const h = fnv1a(s, seeds[i]);
      if (h < sig[i]) sig[i] = h;
    }
  }
  return sig;
}

/** signature를 b개 band로 분할, 각 band의 해시를 버킷 키로 사용 */
function bandKeys(sig: Uint32Array, b: number, r: number): string[] {
  const keys: string[] = [];
  for (let bi = 0; bi < b; bi++) {
    const start = bi * r;
    const end = start + r;
    const band = Array.from(sig.subarray(start, end)).join(',');
    // band 자체도 해시하여 짧은 키로
    const key = createHash('md5').update(`${bi}:${band}`).digest('hex').slice(0, 16);
    keys.push(key);
  }
  return keys;
}

/**
 * Jaccard 유사도 (signature 기반 근사)
 * 같은 위치의 MinHash 값이 같은 비율
 */
function jaccardApprox(sigA: Uint32Array, sigB: Uint32Array): number {
  let same = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) same++;
  }
  return same / sigA.length;
}

export interface LshOptions {
  /** MinHash 차원 (기본 128) — 높을수록 정확, 느림 */
  signatureSize?: number;
  /** band 개수 (기본 32) — b * r = signatureSize */
  numBands?: number;
  /** shingle n-gram 크기 (기본 5) */
  shingleSize?: number;
  /** Jaccard 유사도 임계값 (기본 0.85) */
  threshold?: number;
}

/**
 * LSH 기반 기사 중복 제거.
 * 반환: 대표 기사만 남긴 배열 (본문 길이 최대인 기사 유지)
 */
export function deduplicateArticlesLSH(
  articles: AnalysisInput['articles'],
  options: LshOptions = {},
): AnalysisInput['articles'] {
  if (articles.length <= 1) return articles;

  const k = options.signatureSize ?? 128;
  const b = options.numBands ?? 32;
  const r = Math.floor(k / b);
  const shingleN = options.shingleSize ?? 5;
  const threshold = options.threshold ?? 0.85;

  // 해시 seed 고정 (deterministic)
  const seeds = Array.from({ length: k }, (_, i) => i * 2654435761);

  // 1. 각 기사의 signature 계산
  const signatures: Uint32Array[] = articles.map((a) => {
    const text = `${a.title} ${(a.content ?? '').slice(0, 500)}`;
    return minHashSignature(shingle(text, shingleN), k, seeds);
  });

  // 2. band 버킷으로 후보 pair 수집
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < signatures.length; i++) {
    for (const key of bandKeys(signatures[i], b, r)) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(i);
    }
  }

  // 3. 같은 버킷에 들어간 쌍만 실제 Jaccard 근사 계산
  const dupOf = new Map<number, number>(); // idx → 대표 idx
  for (const indices of buckets.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = indices[i];
        const bb = indices[j];
        if (dupOf.has(a) && dupOf.has(bb)) continue;
        const sim = jaccardApprox(signatures[a], signatures[bb]);
        if (sim < threshold) continue;

        // 본문 길이 더 긴 쪽을 대표로
        const aLen = (articles[a].content ?? '').length;
        const bLen = (articles[bb].content ?? '').length;
        const [keep, drop] = aLen >= bLen ? [a, bb] : [bb, a];
        const finalKeep = dupOf.get(keep) ?? keep;
        dupOf.set(drop, finalKeep);
      }
    }
  }

  // 4. 대표만 남기고 반환 (원본 순서 유지)
  const kept = new Set<number>();
  for (let i = 0; i < articles.length; i++) {
    if (!dupOf.has(i)) kept.add(i);
  }
  return articles.filter((_, i) => kept.has(i));
}
