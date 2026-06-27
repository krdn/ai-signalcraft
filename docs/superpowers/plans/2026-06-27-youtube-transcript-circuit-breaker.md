# YouTube 자막 스크래퍼 Run 단위 회로 차단기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 자막 스크래퍼가 429/403 차단을 run 내에서 2회 누적하면 그 run의 나머지 영상은 자막 호출을 스킵하고 Whisper/description 폴백으로 진행하게 한다.

**Architecture:** `fetchTranscript`의 반환 타입을 판별 유니온(`TranscriptResult`)으로 바꿔 차단 여부를 신호로 노출한다. collect 루프 스코프에 회로 상태를 두고, 순수 함수 `evaluateTranscriptCircuit`로 상태를 전이한다. 회로 발동 여부와 스킵 수는 `CollectionStats`로 노출한다.

**Tech Stack:** TypeScript, Vitest, pnpm 모노레포 (`@ai-signalcraft/collectors`)

## Global Constraints

- 패키지: `@ai-signalcraft/collectors` (`packages/collectors/`)
- 테스트 실행: `pnpm --filter @ai-signalcraft/collectors test` (내부적으로 `TZ=Asia/Seoul vitest run`)
- 테스트 파일 위치: `packages/collectors/tests/`
- `fetchTranscript` 호출처는 단 한 곳: `packages/collectors/src/adapters/youtube-collector.ts:131`
- 임계치 상수: `TRANSCRIPT_BLOCK_THRESHOLD = 2`
- `blocked: true` 판정 기준: HTTP status가 **429 또는 403**
- 불변 패턴 준수 (회로 상태는 스프레드로 새 객체 반환)
- DB 옵션·UI·tRPC 스키마·executor Whisper 폴백은 변경 금지

---

### Task 1: `fetchTranscript` 반환 타입을 판별 유니온으로 변경

**Files:**

- Modify: `packages/collectors/src/utils/youtube-transcript.ts`
- Test: `packages/collectors/tests/youtube-transcript.test.ts` (신규)

**Interfaces:**

- Consumes: (없음)
- Produces:

  ```typescript
  export type TranscriptResult =
    | { ok: true; text: string; lang: string }
    | { ok: false; blocked: boolean };
  export async function fetchTranscript(videoId: string): Promise<TranscriptResult>;
  ```

  `blocked: true`는 player/captions fetch status가 429 또는 403일 때. `no_tracks`/`parse_empty`/`exception`은 `blocked: false`.

- [ ] **Step 1: 실패 테스트 작성**

`packages/collectors/tests/youtube-transcript.test.ts` 생성:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTranscript } from '../src/utils/youtube-transcript';

// player API 정상 응답(자막 트랙 1개) 헬퍼
function playerOkResponse(baseUrl: string) {
  return {
    ok: true,
    json: async () => ({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ languageCode: 'ko', baseUrl }],
        },
      },
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTranscript 반환 신호 분류', () => {
  it('정상 자막은 ok:true와 text/lang을 반환', async () => {
    const xml = '<p start="0">안녕하세요</p><p start="1">반갑습니다</p>';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: true, text: async () => xml }),
    );
    const result = await fetchTranscript('vid1');
    expect(result).toEqual({ ok: true, text: '안녕하세요 반갑습니다', lang: 'ko' });
  });

  it('captions fetch 429는 ok:false, blocked:true', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: false, status: 429 }),
    );
    const result = await fetchTranscript('vid2');
    expect(result).toEqual({ ok: false, blocked: true });
  });

  it('captions fetch 403도 blocked:true', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(playerOkResponse('https://timedtext.example/ko'))
        .mockResolvedValueOnce({ ok: false, status: 403 }),
    );
    const result = await fetchTranscript('vid3');
    expect(result).toEqual({ ok: false, blocked: true });
  });

  it('자막 없는 영상(no_tracks)은 blocked:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ captions: undefined }),
      }),
    );
    const result = await fetchTranscript('vid4');
    expect(result).toEqual({ ok: false, blocked: false });
  });

  it('player API 429는 blocked:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 429 }));
    const result = await fetchTranscript('vid5');
    expect(result).toEqual({ ok: false, blocked: true });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test youtube-transcript`
Expected: FAIL — 현재 `fetchTranscript`는 `{text, lang} | null`을 반환하므로 `toEqual({ ok: true, ... })`에서 실패.

- [ ] **Step 3: 반환 타입 구현**

`packages/collectors/src/utils/youtube-transcript.ts`를 수정한다. `FailReason` 타입 위(16행 부근)에 export 타입을 추가:

```typescript
export type TranscriptResult =
  | { ok: true; text: string; lang: string }
  | { ok: false; blocked: boolean };

// 429/403은 rate-limit/PO token 차단으로 간주
function isBlockedStatus(status: number): boolean {
  return status === 429 || status === 403;
}
```

`fetchTranscript` 본문의 각 `return null`을 다음으로 교체한다 (로그 호출 `logFailure`는 그대로 유지):

- `player_http_error` 분기 (현재 57-58행):
  ```typescript
  if (!resp.ok) {
    logFailure(videoId, 'player_http_error', `status=${resp.status}`);
    return { ok: false, blocked: isBlockedStatus(resp.status) };
  }
  ```
- `no_tracks` 분기 (현재 65-69행):
  ```typescript
  if (!tracks?.length) {
    logFailure(videoId, 'no_tracks');
    return { ok: false, blocked: false };
  }
  ```
- `captions_http_error` 분기 (현재 75-82행):
  ```typescript
  if (!xmlResp.ok) {
    logFailure(
      videoId,
      'captions_http_error',
      `status=${xmlResp.status} lang=${selected.languageCode}`,
    );
    return { ok: false, blocked: isBlockedStatus(xmlResp.status) };
  }
  ```
- `parse_empty` 분기 (현재 92-95행):
  ```typescript
  if (texts.length === 0) {
    logFailure(videoId, 'parse_empty', `xml_bytes=${xml.length} lang=${selected.languageCode}`);
    return { ok: false, blocked: false };
  }
  ```
- 성공 분기 (현재 97-100행):
  ```typescript
  return {
    ok: true,
    text: texts.join(' '),
    lang: selected.languageCode === 'ko' ? 'ko' : selected.languageCode,
  };
  ```
- `catch` 분기 (현재 101-105행):
  ```typescript
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[transcript] ${videoId} reason=exception ${msg}`);
    return { ok: false, blocked: false };
  }
  ```

함수 시그니처도 변경:

```typescript
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test youtube-transcript`
Expected: PASS (5개 테스트)

- [ ] **Step 5: 커밋**

```bash
git add packages/collectors/src/utils/youtube-transcript.ts packages/collectors/tests/youtube-transcript.test.ts
git commit -m "feat: fetchTranscript 반환을 판별 유니온으로 — 429/403 차단 신호 노출"
```

---

### Task 2: 회로 차단기 순수 함수 + 호출처 연결

**Files:**

- Modify: `packages/collectors/src/adapters/youtube-collector.ts` (import 5행, 영상 루프 126-137행, stats 151-160행, 회로 함수 신규)
- Modify: `packages/collectors/src/adapters/base.ts` (`CollectionStats` 인터페이스 63행)
- Test: `packages/collectors/tests/youtube-transcript-circuit.test.ts` (신규)

**Interfaces:**

- Consumes (Task 1에서):
  ```typescript
  type TranscriptResult =
    | { ok: true; text: string; lang: string }
    | { ok: false; blocked: boolean };
  ```
- Produces:

  ```typescript
  export type CircuitState = { blockedCount: number; open: boolean; skipped: number };
  export function evaluateTranscriptCircuit(
    state: CircuitState,
    result: TranscriptResult,
    threshold: number,
  ): CircuitState;
  ```

  `result.ok || !result.blocked`이면 상태 불변. 차단이면 `blockedCount + 1`, `threshold` 도달 시 `open: true`. `open`으로 막혀 스킵된 건수는 호출 루프가 `skipped`에 누적(이 함수가 아니라 루프에서).

- [ ] **Step 1: 실패 테스트 작성**

`packages/collectors/tests/youtube-transcript-circuit.test.ts` 생성:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateTranscriptCircuit, type CircuitState } from '../src/adapters/youtube-collector';

const INITIAL: CircuitState = { blockedCount: 0, open: false, skipped: 0 };
const THRESHOLD = 2;

describe('evaluateTranscriptCircuit', () => {
  it('성공 결과는 상태를 바꾸지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: true, text: 'x', lang: 'ko' }, THRESHOLD);
    expect(next).toEqual(INITIAL);
  });

  it('no_tracks(blocked:false)는 blockedCount를 올리지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: false }, THRESHOLD);
    expect(next.blockedCount).toBe(0);
    expect(next.open).toBe(false);
  });

  it('차단 1회는 회로를 열지 않는다', () => {
    const next = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: true }, THRESHOLD);
    expect(next.blockedCount).toBe(1);
    expect(next.open).toBe(false);
  });

  it('차단 2회 누적 시 회로가 열린다', () => {
    const after1 = evaluateTranscriptCircuit(INITIAL, { ok: false, blocked: true }, THRESHOLD);
    const after2 = evaluateTranscriptCircuit(after1, { ok: false, blocked: true }, THRESHOLD);
    expect(after2.blockedCount).toBe(2);
    expect(after2.open).toBe(true);
  });

  it('이미 열린 회로에 추가 차단이 와도 멱등하게 유지', () => {
    const open: CircuitState = { blockedCount: 2, open: true, skipped: 0 };
    const next = evaluateTranscriptCircuit(open, { ok: false, blocked: true }, THRESHOLD);
    expect(next.open).toBe(true);
    expect(next.blockedCount).toBe(3);
  });

  it('입력 상태를 변형하지 않는다(불변)', () => {
    const frozen = Object.freeze({ ...INITIAL });
    expect(() =>
      evaluateTranscriptCircuit(frozen, { ok: false, blocked: true }, THRESHOLD),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test youtube-transcript-circuit`
Expected: FAIL — `evaluateTranscriptCircuit`/`CircuitState` export가 없음.

- [ ] **Step 3: 순수 함수 구현**

`packages/collectors/src/adapters/youtube-collector.ts` 상단 import 아래(5행 부근)에서 `TranscriptResult` 타입도 함께 import:

```typescript
import { fetchTranscript, type TranscriptResult } from '../utils/youtube-transcript';
```

파일 내 클래스 정의 바깥(상단 import 블록 직후)에 순수 함수와 타입·상수를 추가:

```typescript
export type CircuitState = { blockedCount: number; open: boolean; skipped: number };

const TRANSCRIPT_BLOCK_THRESHOLD = 2;

/**
 * 자막 스크래퍼 차단(429/403)을 run 내에서 집계해 회로를 연다.
 * 성공·no_tracks는 무시. 임계치 도달 시 open=true. 불변 — 새 상태 반환.
 */
export function evaluateTranscriptCircuit(
  state: CircuitState,
  result: TranscriptResult,
  threshold: number,
): CircuitState {
  if (result.ok || !result.blocked) return state;
  const blockedCount = state.blockedCount + 1;
  const open = blockedCount >= threshold;
  if (open && !state.open) {
    console.warn(
      `[transcript] circuit_open run skipping remaining videos (blocked=${blockedCount})`,
    );
  }
  return { ...state, blockedCount, open };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test youtube-transcript-circuit`
Expected: PASS (6개 테스트)

- [ ] **Step 5: collect 루프에 회로 연결 + CollectionStats 확장**

먼저 `packages/collectors/src/adapters/base.ts`의 `CollectionStats` 인터페이스(63행)에서 `usedFallback?: boolean;`(92행) 아래에 두 필드 추가:

```typescript
  usedFallback?: boolean;
  /** run 내 자막 차단 회로가 열렸는지 */
  transcriptCircuitOpen?: boolean;
  /** 회로 open으로 자막 호출을 스킵한 영상 수 */
  transcriptSkippedByCircuit?: number;
```

`youtube-collector.ts`의 `collect()` 메서드에서 영상 루프 시작 전(예: `endReason` 선언 부근 51행 근처)에 회로 상태를 초기화:

```typescript
let circuit: CircuitState = { blockedCount: 0, open: false, skipped: 0 };
```

영상 루프 내부(현재 130-136행)를 다음으로 교체:

```typescript
if (collectTranscript) {
  if (circuit.open) {
    circuit = { ...circuit, skipped: circuit.skipped + 1 };
  } else {
    const result = await fetchTranscript(video.sourceId);
    if (result.ok) {
      video.transcript = result.text;
      video.transcriptLang = result.lang;
    }
    circuit = evaluateTranscriptCircuit(circuit, result, TRANSCRIPT_BLOCK_THRESHOLD);
  }
}
```

stats 객체(현재 151-160행)에 두 필드 추가:

```typescript
this.stats = {
  endReason,
  lastPage,
  perDayCount,
  perDayCapSkip: perDayCapSkip || undefined,
  outOfRange: outOfRange || undefined,
  quotaUsed: this.quota.getUsed(),
  quotaRemaining: this.quota.getRemaining(),
  usedFallback: this.fallbackActive || undefined,
  transcriptCircuitOpen: circuit.open || undefined,
  transcriptSkippedByCircuit: circuit.skipped || undefined,
};
```

- [ ] **Step 6: 전체 테스트·타입체크·빌드 확인**

Run: `pnpm --filter @ai-signalcraft/collectors test`
Expected: PASS (기존 + 신규 모두)

Run: `pnpm --filter @ai-signalcraft/collectors build`
Expected: 타입 에러 없이 빌드 성공 (반환 타입 변경 호환 확인)

- [ ] **Step 7: 커밋**

```bash
git add packages/collectors/src/adapters/youtube-collector.ts packages/collectors/src/adapters/base.ts packages/collectors/tests/youtube-transcript-circuit.test.ts
git commit -m "feat: 자막 스크래퍼 run 단위 회로 차단기 — 429 2회 누적 시 잔여 영상 스킵"
```

---

## Self-Review

**Spec coverage:**

- 컴포넌트 1 (반환 신호 확장) → Task 1 ✓
- 컴포넌트 2 (회로 차단기 + 순수 함수) → Task 2 Step 3, 5 ✓
- 컴포넌트 3 (Run 요약 카운트) → Task 2 Step 5 ✓
- 테스트 전략 (반환 분류) → Task 1 Step 1 ✓
- 테스트 전략 (회로 상태 전이) → Task 2 Step 1 ✓
- "변경하지 않는 것" → DB/UI/executor/tRPC 무변경, 계획에 해당 파일 없음 ✓

**Placeholder scan:** 모든 step에 실제 코드·명령·예상 출력 포함. 플레이스홀더 없음. ✓

**Type consistency:**

- `TranscriptResult`: Task 1 produces, Task 2 consumes — 동일 시그니처 ✓
- `CircuitState`/`evaluateTranscriptCircuit`: Task 2 정의·사용 일관 ✓
- `transcriptCircuitOpen`/`transcriptSkippedByCircuit`: base.ts 정의와 stats 사용 일치 ✓
