# 워커 관리 모달 설계

## Context

AI SignalCraft의 BullMQ 파이프라인에서 워커/큐 관리 기능이 여러 곳에 분산되어 있어 운영이 불편하다. 특히 워커 재시작 후 고아(orphan) active job이 최대 40분간 남아있고, stalled/failed job이 누적되어 새 파이프라인 실행에 영향을 미치는 문제가 반복된다.

현재 분산된 UI(WorkerHealthBadge/Modal, WorkerStatusBar, QueueStatusPage, JobDiagnosticModal)를 하나의 통합 모달로 대체하여, 큐 상태 확인부터 문제 조치까지 한 곳에서 처리할 수 있도록 한다.

## 설계 결정

### 접근 방식: 복합 접근

동일한 `WorkerManagementModal` 컴포넌트를 두 곳에서 열 수 있다:

1. **WorkerHealthBadge** (헤더) — 클릭 시 모달 열림. 전체 큐 오버뷰 (초기 탭: "큐 상태")
2. **WorkerStatusBar** (분석 실행 화면) — "관리" 버튼 클릭 시 모달 열림. 현재 Job에 포커싱 (stalled/failed가 있으면 해당 탭으로 초기화)

기존 `WorkerHealthModal`과 `QueueStatusPage`를 대체한다.

### 레이아웃: 탭 기반

shadcn/ui `Tabs` 컴포넌트를 사용한 4개 탭 구성:

| 탭 | 내용 | 배지 |
|----|------|------|
| **큐 상태** | 3개 큐 카운트 카드 + pause/resume 버튼 | - |
| **Stalled Jobs** | 10분+ 응답 없는 active job 목록 + 개별/일괄 정리 | 빨간 카운트 |
| **Failed Jobs** | 실패 job 목록 + 큐 필터 + 재시도/삭제 | 노란 카운트 |
| **워커** | 큐별 워커 상태 + 재시작 명령어 복사 | - |

### 구현 범위: Phase 1

| ID | 기능 | 설명 |
|----|------|------|
| A1 | 큐별 상태 대시보드 | active/waiting/delayed/failed 카운트, 헬스 상태 |
| A2 | 큐 pause/resume 토글 | 개별 큐 일시정지/재개 버튼 |
| B1 | Stalled Job 목록 & 정리 | 10분+ 무응답 active job 감지, 개별/일괄 제거 |
| B2 | Failed Job 목록 & 재시도/삭제 | 큐별 필터, 실패 사유 표시, 재시도/삭제 |
| B4 | 개별 Job 제거 | 대기/지연 상태 job도 선택 제거 가능 |
| C1 | 워커 헬스 & 목록 | 워커 수, idle 시간, concurrency/lock 설정 표시 |
| D1 | 실행 전 자동 정리 확인 | 새 분석 시작 시 잔여 job 감지 → 확인 다이얼로그 |

Phase 2 (후속): A3(Drain), B3(Active 상세), C2(재시작 명령), D2(Redis), D3(감사 로그)

## 아키텍처

### 컴포넌트 구조

```
apps/web/src/components/admin/
├── worker-management-modal.tsx          # 메인 모달 (Tabs 컨테이너)
├── worker-management/
│   ├── queue-status-tab.tsx             # 탭 1: 큐 상태 + pause/resume
│   ├── stalled-jobs-tab.tsx             # 탭 2: Stalled job 목록 + 정리
│   ├── failed-jobs-tab.tsx              # 탭 3: Failed job 목록 + 재시도/삭제
│   ├── workers-tab.tsx                  # 탭 4: 워커 상태 + 재시작 가이드
│   └── types.ts                         # 공유 타입
```

### 백엔드 API 확장

기존 tRPC 라우터를 확장:

```
apps/web/src/server/trpc/routers/admin/worker-management.ts  # 새 라우터
```

**새 프로시저:**

| 프로시저 | 용도 | 기존 재사용 |
|---------|------|------------|
| `getQueueOverview` | 큐 카운트 + 헬스 + stalled/failed 목록 통합 조회 | `getWorkerStatus()` + `getQueueStatus()` 통합 |
| `pauseQueue(queueName)` | 개별 큐 pause | BullMQ Queue.pause() |
| `resumeQueue(queueName)` | 개별 큐 resume | BullMQ Queue.resume() |
| `removeStalledJobs(jobIds)` | stalled job 일괄 제거 | `forceCleanupActiveJob()` 확장 |
| `retryFailedJob(bullmqId, queueName)` | failed job 재시도 | BullMQ Job.retry() |
| `removeFailedJobs(bullmqIds, queueName)` | failed job 일괄 삭제 | BullMQ Job.remove() |
| `removeJob(bullmqId, queueName)` | 개별 job 제거 | BullMQ Job.remove() |
| `checkOrphanedJobs()` | 새 파이프라인 실행 전 고아 job 확인 | `cleanupBeforeNewPipeline()` 의 dry-run 버전 |
| `cleanupOrphanedJobs()` | 고아 job 실제 정리 | `cleanupBeforeNewPipeline()` |

### 데이터 흐름

```
WorkerManagementModal
  ├── useQuery('admin.workerMgmt.getQueueOverview', { refetchInterval: 5000 })
  │   → 모든 탭에 데이터 분배
  │
  ├── QueueStatusTab
  │   └── useMutation('admin.workerMgmt.pauseQueue' / 'resumeQueue')
  │
  ├── StalledJobsTab
  │   └── useMutation('admin.workerMgmt.removeStalledJobs')
  │
  ├── FailedJobsTab
  │   ├── useMutation('admin.workerMgmt.retryFailedJob')
  │   └── useMutation('admin.workerMgmt.removeFailedJobs')
  │
  └── WorkersTab (읽기 전용)
```

### D1: 실행 전 자동 정리

분석 실행 트리거 위치인 `apps/web/src/components/analysis/new-analysis-form.tsx`(또는 해당 컴포넌트)에서:

1. "새 분석 실행" 클릭
2. `checkOrphanedJobs()` 호출
3. 고아 job이 있으면 AlertDialog 표시:
   - "이전 작업 N개가 남아있습니다. 정리 후 실행할까요?"
   - [정리 후 실행] / [그냥 실행] / [취소]
4. 사용자 선택에 따라 `cleanupOrphanedJobs()` 호출 후 분석 트리거

### 진입점별 초기 탭 로직

```typescript
type WorkerModalProps = {
  defaultTab?: 'queue-status' | 'stalled' | 'failed' | 'workers';
  focusJobId?: number;  // WorkerStatusBar에서 열 때 현재 Job ID
};

// WorkerHealthBadge에서 열 때:
<WorkerManagementModal defaultTab="queue-status" />

// WorkerStatusBar에서 열 때:
<WorkerManagementModal
  defaultTab={hasStalledJobs ? 'stalled' : 'queue-status'}
  focusJobId={currentJobId}
/>
```

## 기존 코드 재사용

| 기존 함수/컴포넌트 | 파일 | 재사용 방법 |
|----|------|------------|
| `getWorkerStatus()` | `packages/core/src/queue/worker-health.ts` | 워커 탭 데이터 소스 |
| `getQueueStatus()` | `packages/core/src/pipeline/queue-management.ts` | 큐 상태 + stalled/failed 목록 |
| `forceCleanupActiveJob()` | `packages/core/src/pipeline/queue-management.ts` | stalled job 정리 확장 |
| `cleanupBeforeNewPipeline()` | `packages/core/src/pipeline/queue-management.ts` | D1 자동 정리 |
| `getQueue()` | `packages/core/src/pipeline/queue-management.ts` | pause/resume/retry |
| Dialog/AlertDialog | `apps/web/src/components/ui/` | 모달 프레임 |
| Tabs | `apps/web/src/components/ui/tabs.tsx` | 탭 컨테이너 |
| toast | 기존 toast 유틸 | 액션 결과 알림 |

## 대체/제거 대상

| 기존 컴포넌트 | 처리 |
|-------------|------|
| `WorkerHealthModal` (`admin/worker-health-modal.tsx`) | 새 모달로 대체, 파일 제거 |
| `QueueStatusPage` (`app/queue-status/page.tsx`) | 새 모달로 대체, 페이지 제거 |
| `WorkerHealthBadge` | 유지 — 클릭 핸들러만 새 모달로 변경 |
| `WorkerStatusBar` | 유지 — "관리" 버튼 추가하여 새 모달 연결 |

## 검증 방법

1. **워커 배지** 클릭 → 모달 열림 → 큐 상태 탭 기본 표시
2. **파이프라인 모니터 상태바** → "관리" 버튼 → 모달 열림 (stalled 있으면 해당 탭)
3. **큐 pause/resume** → 토글 후 상태 변경 확인
4. **Stalled job 정리** → 개별/일괄 제거 후 카운트 감소 확인
5. **Failed job 재시도** → 재시도 후 큐에 다시 들어가는지 확인
6. **Failed job 삭제** → 삭제 후 목록에서 제거 확인
7. **새 분석 실행 전** → 고아 job 있을 때 확인 다이얼로그 표시 → 정리 후 실행
8. **자동 갱신** → 5초 간격으로 데이터 갱신 확인
9. **기존 기능 회귀** → WorkerStatusBar의 인라인 기능 정상 작동 확인
