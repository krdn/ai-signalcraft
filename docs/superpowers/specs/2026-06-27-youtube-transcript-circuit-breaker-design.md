# YouTube 자막 스크래퍼 Run 단위 회로 차단기 설계

- **작성일**: 2026-06-27
- **브랜치**: fix/rag-fallback-gate-data-loss (또는 신규 브랜치)
- **상태**: 승인됨, 구현 대기

## 문제

YouTube가 2024–2025 사이 자막 엔드포인트(`api/timedtext`)에 BotGuard/PO token 보호를
확대하면서, 쿠키·PO token 없이는 자막 다운로드가 HTTP 429로 거부된다.

현재 `fetchTranscript`는 영상마다 개별 호출되며 차단 시 `null`을 반환한 뒤
다음 영상에서 **또 시도**한다. 차단 상태에서 N개 영상 = N번의 무의미한 429 요청
→ 차단 심화 + 수집 시간 낭비.

## 결정 사항 (브레인스토밍 합의)

1. **차단 시 자동 스킵** — 옵션 우회 수단(쿠키·프록시) 추가가 아님
2. **Run 단위 회로 차단기** — 한 run 내에서 429를 임계치만큼 맞으면 그 run의
   나머지 영상은 자막 호출을 아예 스킵
3. **DB 옵션은 유지, 런타임만 스킵** — `subscriptions.options.collectTranscript`를
   건드리지 않는다. 다음 run에서 자동 재시도 (차단이 풀릴 수 있으므로). 사용자 설정 존중.
4. **로그 + run 요약 카운트** — 회로 차단 발동을 로그로 남기고, run stats에
   스킵된 자막 수를 실어 운영자가 "자막이 왜 안 쌓였지"를 파악하게 한다.

## 해결 방향

사용자 설정(`collectTranscript`)은 그대로 두고, **run(=collect 1회 실행) 스코프에서만**
회로 차단기를 둔다. 차단을 임계치만큼 맞으면 그 run의 나머지 영상은 자막 호출을
스킵하고, 기존 Whisper/description 폴백으로 진행한다.

## 컴포넌트

### 1. `fetchTranscript` 반환 신호 확장

**파일**: `packages/collectors/src/utils/youtube-transcript.ts`

현재는 성공 시 `{text, lang}`, 실패 시 `null`만 반환한다. 회로 차단기가
"차단(429) vs 단순 자막 없음(no_tracks)"을 구분하려면 실패 사유가 필요하다.

모듈 주석의 "인터페이스를 유지한다" 의도를 존중해, 반환 타입을 깨지 않는 방식으로
차단 신호만 추가한다:

```typescript
type TranscriptResult = { ok: true; text: string; lang: string } | { ok: false; blocked: boolean }; // blocked=true: 429/403 rate-limit, false: no_tracks 등
```

- `captions_http_error`·`player_http_error`의 status가 **429 또는 403**일 때만 `blocked: true`
- `no_tracks`/`parse_empty`/`exception`은 `blocked: false`
- 기존 로그(`logFailure`)는 그대로 유지

### 2. 회로 차단기 (collect 루프)

**파일**: `packages/collectors/src/adapters/youtube-collector.ts` (영상 루프 126-137행)

회로 상태를 **`collect` 메서드 스코프의 지역 변수**로 둔다 (모듈 전역 아님 —
동시 run 간 오염 방지).

```typescript
// collect() 시작 부분 (루프 바깥)
const TRANSCRIPT_BLOCK_THRESHOLD = 2; // 429 2회 누적 시 회로 open
let circuit = { blockedCount: 0, open: false, skipped: 0 };
```

루프 내부에서 순수 함수로 상태를 전이한다:

```typescript
if (collectTranscript) {
  if (circuit.open) {
    circuit = { ...circuit, skipped: circuit.skipped + 1 }; // 호출 자체 스킵
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

#### 순수 함수 추출 (테스트 용이성)

회로 로직을 제너레이터에 인라인으로 묻지 않고 작은 불변 함수로 추출한다:

```typescript
type CircuitState = { blockedCount: number; open: boolean; skipped: number };

function evaluateTranscriptCircuit(
  state: CircuitState,
  result: TranscriptResult,
  threshold: number,
): CircuitState {
  if (result.ok || !result.blocked) return state; // 성공·no_tracks는 카운트 안 함
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

회로가 열려도 executor의 Whisper 폴백은 자동 작동한다 — `transcript === ''`인 영상을
Whisper 후보로 누적하는 로직(`executor.ts:204-219`)은 자막 스킵 여부와 무관하기 때문.

### 3. Run 요약 카운트 (CollectionStats)

**파일**: `packages/collectors/src/adapters/base.ts` (`CollectionStats` 인터페이스, 63행)

```typescript
export interface CollectionStats {
  // ... 기존 필드
  transcriptCircuitOpen?: boolean;
  transcriptSkippedByCircuit?: number;
}
```

**파일**: `youtube-collector.ts` (stats 객체, 151-160행) — 기존 `|| undefined` 패턴에 맞춰 채운다:

```typescript
this.stats = {
  // ...
  transcriptCircuitOpen: circuit.open || undefined,
  transcriptSkippedByCircuit: circuit.skipped || undefined,
};
```

## 테스트 전략

### `youtube-transcript.test.ts` (신규) — 반환 신호 분류

- 429 응답 → `{ ok: false, blocked: true }`
- 403 응답 → `{ ok: false, blocked: true }`
- `no_tracks` (빈 captionTracks) → `{ ok: false, blocked: false }`
- 정상 자막 → `{ ok: true, text, lang }`

### 회로 차단기 테스트 (신규) — `evaluateTranscriptCircuit` 상태 전이

- 429를 임계치(2회) 맞으면 `open: true`
- `no_tracks`(blocked=false)는 `blockedCount` 증가 안 함 → 회로 안 열림
- 성공 결과는 상태 불변
- 임계치 도달 후 추가 호출은 상태 유지 (멱등)

## 변경하지 않는 것

- **DB 옵션** `subscriptions.options.collectTranscript`
- **UI 토글** (`analysis-options.tsx`)
- **executor의 Whisper 폴백** (자동으로 폴백 경로로 흐름)
- **tRPC 스키마**

`fetchTranscript`의 호출처는 단 한 곳(`youtube-collector.ts:131`)으로 grep 확인됨.

## 변경 파일 요약

| 파일                                                    | 변경                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/collectors/src/utils/youtube-transcript.ts`   | 반환 타입을 `TranscriptResult` 판별 유니온으로, 429/403 시 `blocked: true`      |
| `packages/collectors/src/adapters/youtube-collector.ts` | collect 루프에 회로 차단기, `evaluateTranscriptCircuit` 순수 함수, stats 카운트 |
| `packages/collectors/src/adapters/base.ts`              | `CollectionStats`에 `transcriptCircuitOpen?`, `transcriptSkippedByCircuit?`     |
| `youtube-transcript.test.ts` (신규)                     | 반환 신호 분류 테스트                                                           |
| 회로 테스트 (신규)                                      | `evaluateTranscriptCircuit` 상태 전이 테스트                                    |
