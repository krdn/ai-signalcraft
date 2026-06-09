# raw_items 중복 방지 강화 설계

**Date**: 2026-04-20
**Status**: Approved, pending implementation
**Author**: krdn.net@gmail.com (with Claude)

## 1. 문제 정의

`apps/collector/src/queue/item-mapper.ts:78`는 수집된 아이템의 하이퍼테이블 시간 컬럼을 다음과 같이 산출한다.

```ts
const time = publishedAt ?? new Date();
```

TimescaleDB 제약으로 `raw_items`의 dedup UNIQUE 인덱스는 `(source, source_id, item_type, time)`이다(`apply-hypertables.ts:49-52`). `publishedAt`이 채워진 아이템은 값이 불변이라 문제없지만, `publishedAt`이 null인 아이템은 폴백이 `new Date()`라 재수집 때마다 다른 time이 생성되어 UNIQUE 제약을 우회한다. `onConflictDoNothing`은 같은 키 조합이 있을 때만 동작하므로 이 경우 중복 INSERT를 막지 못한다.

**실측 데이터** (운영 DB `ais_collection`, 2026-04-20):

| source / item_type   | total | published_at NULL | 실제 중복 행 |
| -------------------- | ----- | ----------------- | ------------ |
| naver-news / article | 6,820 | 526 (7.7%)        | **302**      |
| dcinside / article   | 1,827 | 0                 | 2            |
| 나머지 9개 조합      | -     | 0                 | 0            |

naver-news 중복 샘플은 `ext_*` 접두사(외부 언론사 링크)에 집중되어 있고, 같은 기사가 4번씩 저장된 사례 다수. 방치하면 분석 입력 왜곡과 저장소 낭비가 선형 누적된다.

## 2. 해결책: day-bucket sentinel

`publishedAt`이 null일 때 `time`을 **수집 시각의 UTC 자정**으로 절삭한다.

```ts
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const time = publishedAt ?? startOfUtcDay(new Date());
```

**효과**:

- 같은 날 같은 sourceId 재수집 → 동일 time → UNIQUE 충돌 → `DO NOTHING`으로 무시 (방어선 복구)
- 다른 날 재수집 시 새로운 time 생성 가능 → 최대 하루 1개 중복 허용 (무한 누적 차단이 목적, 허용 범위)
- TimescaleDB 청크 분포는 날짜별로 자연스럽게 유지 (epoch 고정처럼 1970년 청크에 몰리지 않음)

**다른 옵션을 채택하지 않은 이유**:

- **고정 epoch (1970-01-01)**: 완전 중복 차단이 더 강하지만 모든 NULL 아이템이 1개 청크에 몰려 TimescaleDB 청크 정책과 충돌. 조회 패턴도 부자연스러워짐.
- **sha1 기반 deterministic time**: 청크 분포는 좋지만 time의 의미가 모호해지고 디버깅·조회가 어려워짐.
- **UNIQUE 인덱스 구조 변경**: 훨씬 큰 변경(스키마 재설계, dedup 테이블 분리). 하이퍼테이블 원칙 훼손.
- **수집기 어댑터에서 publishedAt 파싱 강화**: 근본 해결에 가깝지만 외부 언론사 수만큼 파싱 로직이 필요하고, 새 수집기를 추가할 때마다 같은 문제가 재발. Safety net이 먼저 필요.

## 3. 변경 범위

| 파일                                                   | 변경 내용                                   |
| ------------------------------------------------------ | ------------------------------------------- |
| `apps/collector/src/queue/item-mapper.ts`              | `startOfUtcDay` 헬퍼 추가, `time` 계산 변경 |
| `apps/collector/src/queue/item-mapper.test.ts`         | publishedAt null 케이스 회귀 테스트 추가    |
| `apps/collector/src/scripts/dedup-raw-items.ts` (신규) | 기존 중복 정리 스크립트 (dry-run 지원)      |

DB 스키마, 마이그레이션, UNIQUE 인덱스는 **변경하지 않는다**.

## 4. 테스트 전략 (TDD)

구현 전에 실패하는 테스트를 먼저 작성한다:

1. **time 폴백 검증**: `publishedAt === null`인 입력에 대해 반환된 `row.time`이 `startOfUtcDay(new Date())`와 일치
2. **멱등성 검증**: 같은 raw(publishedAt null)를 연속 호출하면 두 번 모두 동일한 `time` 반환 (같은 UTC day 내)
3. **회귀 방지**: publishedAt이 정상 Date인 경우 기존 동작 유지 — `row.time === row.publishedAt`

기존 `item-mapper.test.ts:101-103`의 "publishedAt이 없으면 … now 폴백" 테스트는 **새 기대치로 교체** (time === UTC 자정). 나머지 케이스는 그대로 유지.

## 5. 기존 중복 정리 스크립트

위치: `apps/collector/src/scripts/dedup-raw-items.ts`

사용법:

```bash
pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts --dry-run
pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts
```

동작:

1. `(source, source_id, item_type)` 그룹에서 `COUNT(*) > 1`인 조합 조회
2. 각 그룹에서 `fetched_at` 가장 이른 행을 **유지**, 나머지를 `DELETE`
3. dry-run이면 카운트만 출력하고 종료
4. 압축된 청크의 행은 DELETE 실패 가능 → 에러 로그 후 다음 그룹으로 계속
5. 최종 요약 출력: 처리 그룹 수, 삭제 행 수, 실패 수

302개 중복 전부 최근 7일 이내(압축 전)에 있으므로 압축 청크 이슈는 실질적으로 없을 가능성이 높지만, 방어적으로 try/catch 처리.

## 6. 배포·롤백

- **하위 호환**: 스키마 변경 없음. 기존 아이템 읽기/쓰기 영향 없음.
- **무중단 배포**: collector worker 재시작만 필요. API·web 변경 없음.
- **롤백**: item-mapper.ts를 되돌리면 즉시 이전 동작으로 복귀. dedup 스크립트 실행 결과는 되돌릴 수 없으므로 운영 실행 전 dry-run 필수.

## 7. 스코프 외 (별도 이슈)

- **이슈 A** — 구독 삭제 시 raw_items orphan 처리 (archive 방식 도입)
- **이슈 C** — `onConflictDoNothing` 때문에 metrics(조회수·좋아요)가 갱신되지 않는 문제
- **naver-news adapter publishedAt 파싱 보강** — 외부 링크의 게시일 추출 개선 (현재 설계는 safety net, 이것은 근본 해결)

이 세 가지는 본 PR 스코프에 포함하지 않는다.

## 8. 수용 기준

- [ ] `pnpm --filter @ai-signalcraft/collector test`에서 신규 테스트 3개 포함 전체 통과
- [ ] dry-run 스크립트가 운영 DB에서 ~302건 중복을 정확히 리포트
- [ ] 실행 후 `SELECT COUNT(*) - COUNT(DISTINCT (source, source_id, item_type)) FROM raw_items` 결과가 0
- [ ] 배포 후 24시간 동안 naver-news 기사 중복이 0에 수렴 (모니터링 쿼리로 확인)
