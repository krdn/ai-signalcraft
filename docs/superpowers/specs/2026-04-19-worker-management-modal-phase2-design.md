# 워커 관리 모달 Phase 2 설계

## Context

Phase 1에서 워커 관리 모달의 핵심 기능(큐 상태, Stalled/Failed Job 정리, 워커 헬스)을 구현했다. Phase 2는 기존 모달에 편의/모니터링 기능을 추가하여 운영 효율을 높인다.

## 설계 결정

- **D2/D3 배치**: 새 "시스템" 탭 하나에 Redis 현황 + 감사 로그 통합
- **D3 저장**: Redis 리스트 (DB 마이그레이션 불필요, 최근 100건, 7일 TTL)
- **C2 방식**: 워커 상태별 상황 가이드 (단순 명령어 나열이 아닌 조건부 권장 조치)

## 기능 상세

### A3: 큐 Drain (비우기)

**위치**: 큐 상태 탭 — 각 큐 카드의 pause/resume 버튼 옆에 "비우기" 버튼 추가

**동작**:
1. 비우기 버튼 클릭 → AlertDialog 확인 ("collectors 큐의 모든 대기 작업을 제거합니다")
2. 확인 시 `drainQueue` mutation 호출
3. 결과 toast + 자동 새로고침

**백엔드**:
- `drainQueue(queueName: string)`: BullMQ `queue.drain()` 호출 → waiting/delayed job 전체 제거
- active job은 건드리지 않음 (BullMQ drain의 기본 동작)

### B3: Active Job 상세

**위치**: 큐 상태 탭 — 각 큐 카드를 Collapsible로 감싸서 클릭 시 active job 목록 표시

**표시 정보**:
- job 이름, dbJobId, 경과시간 (processedOn 기준)
- 개별 job 제거 버튼 (기존 `removeJob` mutation 재사용)

**데이터**: 기존 `getQueueOverview`의 `queueStatus.queues[].jobs`에서 `state === 'active'`만 필터. 추가 API 불필요.

### C2: 워커 상황별 가이드

**위치**: 워커 탭 — 기존 재시작 명령어 영역 확장

**상태별 권장 조치**:

| 상태 | 메시지 | 명령어 |
|------|--------|--------|
| `down` | "워커가 다운되었습니다. 즉시 재시작하세요." | `dserver restart ais-prod-worker` |
| `stuck` | "대기 작업이 처리되지 않고 있습니다. 로그를 확인하세요." | `dserver logs ais-prod-worker --tail 50` |
| `warn` | "활성 워커가 응답하지 않습니다. 재시작을 고려하세요." | `dserver restart ais-prod-worker` |
| `healthy`/`idle` | "정상 상태입니다." | - |

**명령어 목록** (항상 표시):
- 재시작: `dserver restart ais-prod-worker`
- 로그 확인: `dserver logs ais-prod-worker --tail 50`
- 강제 중지: `dserver stop ais-prod-worker`

각 명령어에 복사 버튼 제공.

### D2: Redis 메모리/키 현황

**위치**: 시스템 탭 상단

**표시 정보**:
- 사용 메모리 / 최대 메모리
- 총 키 수
- prefix별 키 분포 (bull:*, ais-dev:*, ais:* 등)

**백엔드**: `getRedisInfo()` → Redis `INFO memory` 파싱 + `DBSIZE` + prefix별 `SCAN` 카운트

### D3: 감사 로그

**위치**: 시스템 탭 하단

**저장**:
- Redis 리스트 키: `{cachePrefix}:worker-audit-log`
- 최대 100건 (LTRIM으로 관리)
- 각 엔트리 TTL 없음 (리스트 자체를 100건으로 제한)

**기록 대상**: 모든 worker management mutation 실행 시 로그 기록
- 액션: pause, resume, drain, remove-stalled, retry-failed, remove-failed, remove-job, cleanup-orphaned
- 포함 정보: timestamp, action, target (큐 이름 또는 job ID), result (성공/실패), count (영향받은 수)

**표시**: 최근 기록을 시간순으로 테이블 표시 (시간, 액션, 대상, 결과)

## 아키텍처

### 새로 생성
| 파일 | 역할 |
|------|------|
| `apps/web/src/components/admin/worker-management/system-tab.tsx` | 시스템 탭 (Redis + 감사 로그) |
| `packages/core/src/pipeline/worker-audit.ts` | 감사 로그 기록/조회 |

### 수정
| 파일 | 변경 |
|------|------|
| `packages/core/src/pipeline/worker-management.ts` | `drainQueue()`, `getRedisInfo()` 추가 |
| `packages/core/src/pipeline/control.ts` | 새 함수 re-export 추가 |
| `apps/web/src/server/trpc/routers/admin/worker-management.ts` | drain, redisInfo, auditLog 프로시저 추가 + 기존 mutation에 감사 로그 기록 삽입 |
| `apps/web/src/components/admin/worker-management-modal.tsx` | 시스템 탭 추가 |
| `apps/web/src/components/admin/worker-management/queue-status-tab.tsx` | drain 버튼 + active job collapsible 추가 |
| `apps/web/src/components/admin/worker-management/workers-tab.tsx` | 상황별 가이드 + 다중 명령어 |
| `apps/web/src/components/admin/worker-management/types.ts` | WorkerModalTab에 'system' 추가 |

### 기존 재사용
| 함수 | 용도 |
|------|------|
| `removeJob()` | B3 active job 개별 제거 |
| `getQueueOverview()` | B3 active job 데이터 (추가 API 불필요) |
| `getCacheRedis()` | D2 Redis info 조회 |
| `getCachePrefix()` | D3 감사 로그 키 prefix |

## 검증 방법

1. 큐 상태 탭에서 "비우기" 버튼 → AlertDialog 확인 → drain 실행
2. 큐 카드 클릭 → active job 목록 펼쳐짐 → 개별 제거 가능
3. 워커 탭에서 상태별 권장 조치 표시 확인 (down 워커가 있을 때)
4. 시스템 탭에서 Redis 메모리/키 현황 표시
5. mutation 실행 후 시스템 탭의 감사 로그에 기록 확인
6. 전체 빌드 성공
