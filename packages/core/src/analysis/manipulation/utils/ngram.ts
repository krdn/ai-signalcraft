// 연속 공백을 단일 스페이스로 축약 + 양끝 트림
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// 길이 n의 슬라이딩 윈도우로 문자 n-gram 집합 생성
// 텍스트 길이가 n 미만이면 빈 집합 반환
// 주의: .length / .slice는 UTF-16 코드 유닛 기준.
// BMP 한글(가-힣)은 단일 유닛이라 안전. 이모지(U+1F000+)는 서로게이트 쌍 — 추후 Array.from 전환 고려.
export function ngramSet(text: string, n: number): Set<string> {
  const normalized = normalize(text);
  const set = new Set<string>();
  if (normalized.length < n) return set;
  for (let i = 0; i <= normalized.length - n; i++) {
    set.add(normalized.slice(i, i + n));
  }
  return set;
}

// Jaccard 계수 = |A ∩ B| / |A ∪ B|
// 두 집합 모두 비어 있으면 0 (NaN 방지)
// 작은 집합을 순회하여 has() 호출 횟수를 최소화
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const v of smaller) {
    if (larger.has(v)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
