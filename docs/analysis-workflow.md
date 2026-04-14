> **소스**: `/home/gon/projects/ai/ai-signalcraft` (프로젝트 분석)
> **작성일**: 2026-04-13

# AI SignalCraft — 분석 실행 워크플로우

## 목차

1. [시스템 전체 구성](#1-시스템-전체-구성)
2. [프론트엔드 (Next.js Web)](#2-프론트엔드)
3. [API 레이어 (tRPC + SSE)](#3-api-레이어)
4. [BullMQ 큐 시스템](#4-bullmq-큐-시스템)
5. [수집(Collect) 워커](#5-수집-워커)
6. [정규화(Normalize) 워커](#6-정규화-워커)
7. [영속화(Persist) 워커](#7-영속화-워커)
8. [AI 분석(Analysis) 워커](#8-ai-분석-워커)
9. [분석 Stage 상세](#9-분석-stage-상세)
10. [데이터베이스 레이어](#10-데이터베이스-레이어)
11. [파이프라인 제어](#11-파이프라인-제어)
12. [전체 데이터 흐름 요약](#12-전체-데이터-흐름-요약)

---

## 1. 시스템 전체 구성

### 레이어 구조

| 레이어     | 구성요소                           | 역할                          |
| ---------- | ---------------------------------- | ----------------------------- |
| 프론트엔드 | Next.js 15 App Router              | UI, tRPC 클라이언트, SSE 수신 |
| API        | tRPC 11 + SSE                      | 파이프라인 제어, 실시간 상태  |
| 큐         | BullMQ 5 + Redis 7                 | 비동기 작업 오케스트레이션    |
| 워커       | collectors / pipeline / analysis   | 수집, 정규화, AI 분석         |
| DB         | PostgreSQL 16 + Drizzle ORM        | 영속 저장                     |
| AI         | Claude / GPT / Gemini (ai-gateway) | 14개+ 분석 모듈               |

### 환경 분리

| 구분 | DB                                    | Redis               | BullMQ prefix |
| ---- | ------------------------------------- | ------------------- | ------------- |
| 개발 | 192.168.0.5:5438/ai_signalcraft       | 192.168.0.5:6385    | ais-dev       |
| 운영 | postgres:5432/ai_signalcraft (Docker) | redis:6379 (Docker) | bull          |

---

## 2. 프론트엔드

### 분석 트리거 흐름

1. 사용자가 `/dashboard`에서 키워드 + 날짜 + 소스 + 도메인 선택
2. `tRPC pipeline.trigger` 뮤테이션 → `collection_jobs` 레코드 생성 + `triggerCollection()` 실행
3. UI가 `jobId`를 받아 `/api/pipeline/[jobId]/stream` SSE 연결 시작
4. `PipelineStatusPanel`에 실시간 진행률 렌더링

### 주요 페이지

| 경로                           | 역할                  |
| ------------------------------ | --------------------- |
| `/dashboard`                   | 분석 트리거, 히스토리 |
| `/api/pipeline/[jobId]/stream` | SSE 실시간 상태       |
| `/api/trpc/[trpc]`             | tRPC 엔드포인트       |
| `/admin/jobs`                  | 전체 job 관리         |
| `/admin/sources`               | 커스텀 RSS/HTML 소스  |
| `/admin/presets`               | AI 모델 프리셋        |
| `/queue-status`                | BullMQ 큐 현황        |

---

## 3. API 레이어

### tRPC 파이프라인 프로시저

| 프로시저                | 타입     | 설명                    |
| ----------------------- | -------- | ----------------------- |
| `pipeline.trigger`      | mutation | 파이프라인 시작         |
| `pipeline.getStatus`    | query    | 상태 폴링               |
| `pipeline.cancel`       | mutation | 중지                    |
| `pipeline.pause`        | mutation | 일시정지                |
| `pipeline.resume`       | mutation | 재개                    |
| `pipeline.skipModules`  | mutation | 특정 모듈 스킵          |
| `pipeline.setCostLimit` | mutation | AI 비용 한도 설정       |
| `pipeline.queueStatus`  | query    | BullMQ 큐 상태 (관리자) |

### SSE 스트리밍

- 매 1초 DB 폴링 (`collection_jobs` + `analysis_results`)
- `pipeline-status/events.ts`에서 이벤트 로그 합성 (수집 → 분석 → 리포트 순서)

---

## 4. BullMQ 큐 시스템

### 큐 종류

| 큐 이름      | 워커             | 역할            |
| ------------ | ---------------- | --------------- |
| `collectors` | collector-worker | 외부 소스 수집  |
| `pipeline`   | pipeline-worker  | 정규화 + 영속화 |
| `analysis`   | analysis-worker  | AI 분석 전체    |

### Flow 구조 (부모-자식 관계)

```
persist (pipeline)
├── normalize-naver (pipeline)
│   └── collect-naver-articles (collectors)
├── normalize-youtube (pipeline)
│   └── collect-youtube-videos (collectors)
├── normalize-community-dcinside (pipeline)
│   └── collect-dcinside (collectors)
├── normalize-community-fmkorea (pipeline)
│   └── collect-fmkorea (collectors)
├── normalize-community-clien (pipeline)
│   └── collect-clien (collectors)
└── normalize-feed-{id} (pipeline) ← 동적 RSS/HTML
    └── collect-feed-{id} (collectors)
```

자식이 모두 완료되어야 부모 실행. 각 소스는 독립 실행(부분 실패 허용).

---

## 5. 수집 워커

**파일**: `packages/core/src/queue/collector-worker.ts`

### 처리 흐름

1. `collectors` 큐에서 job 수신
2. `source` 필드로 수집기 인스턴스 조회 (`registry.ts`)
3. 동적 소스면 `buildDynamicCollector()`로 팩토리 생성
4. `collector.collect()` AsyncGenerator 호출 → 청크 단위 수집
5. 매 청크: 취소 확인 + DB 진행률 업데이트

### 수집기 어댑터

| 어댑터           | 방식                  | 대상        |
| ---------------- | --------------------- | ----------- |
| naver-news       | HTTP API              | 네이버 뉴스 |
| naver-comments   | HTTP API              | 기사별 댓글 |
| youtube-videos   | YouTube Data API v3   | 유튜브 영상 |
| youtube-comments | YouTube Data API v3   | 영상별 댓글 |
| dcinside         | Playwright (헤드리스) | 게시글+댓글 |
| fmkorea          | Cheerio (HTML)        | 게시글+댓글 |
| clien            | Cheerio (HTML)        | 게시글+댓글 |
| rss              | RSS 파싱              | 동적 피드   |
| html             | Cheerio               | 동적 HTML   |

---

## 6. 정규화 워커

**파일**: `packages/core/src/queue/pipeline-worker.ts` (normalize-\* 처리)

### 네이버 정규화

1. 자식 job 결과 수신 (`job.getChildrenValues()`)
2. `n.news.naver.com` URL만 필터
3. **병렬 댓글 수집** (동시 4개 기사, 세마포어)
4. 결과: `{ 'naver-news': {...}, 'naver-comments': {...} }`

### 유튜브 정규화

1. 영상 `sourceId` 추출
2. **병렬 댓글 수집** (동시 3개, YouTube quota 고려)
3. 결과: `{ 'youtube-videos': {...}, 'youtube-comments': {...} }`

### 커뮤니티 정규화

- 수집기 자체가 게시글+댓글 통합 반환 → 별도 댓글 수집 불필요

---

## 7. 영속화 워커

**파일**: `packages/core/src/queue/pipeline-worker.ts` (persist 처리)

### DB 저장 순서 (FK 무결성)

1. 기사(articles) 저장 → sourceId→dbId 매핑
2. 영상(videos) 저장 → sourceId→dbId 매핑
3. 네이버 댓글 저장 (articleId FK 연결)
4. 유튜브 댓글 저장 (videoId FK 연결)
5. 커뮤니티 게시글 → 댓글 FK 연결
6. RSS/HTML 피드 저장 + `lastCollectedAt` 갱신

### Persist 완료 후

1. **임베딩 생성** (비차단 백그라운드): 기사 + 댓글 벡터 임베딩
2. 취소 확인 → Stage Gate 확인
3. `triggerAnalysis(dbJobId, keyword)` — analysis 큐 트리거

---

## 8. AI 분석 워커

**파일**: `packages/core/src/queue/analysis-worker.ts`

### 워커 설정

| 항목            | 값               |
| --------------- | ---------------- |
| lockDuration    | 600,000ms (10분) |
| stalledInterval | 300,000ms        |
| maxStalledCount | 2                |
| lock 자동 갱신  | 120초마다        |

### 분석 완료 후 status

| 조건                          | status            |
| ----------------------------- | ----------------- |
| 모든 모듈 성공                | `completed`       |
| 일부 모듈 실패 또는 비용 초과 | `partial_failure` |
| 사용자 취소                   | `cancelled`       |

### 재실행(Resume) 지원

- `triggerAnalysisResume()` — 실패/미실행 모듈만 재실행
- `retryModules` — 특정 모듈만 지정 재실행
- `reportOnly` — 완료 결과로만 리포트 재생성

---

## 9. 분석 Stage 상세

**파일**: `packages/core/src/analysis/pipeline-orchestrator.ts`

### Stage 실행 순서

```
Stage 0: 개별 항목 분석 (선택적)
         └─ 기사/영상별 개별 AI 분석

Stage 1: 병렬 실행 (4개 모듈 동시)
         ├─ macro-view        — 거시적 여론 지형
         ├─ segmentation      — 여론 세그먼트 분류
         ├─ sentiment-framing — 감성/프레이밍 분석
         └─ message-impact    — 핵심 메시지 영향력

Stage 2: 순차/병렬 혼합 (Stage 1 의존)
         ├─ risk-map + opportunity (병렬)
         └─ strategy (순차)

Stage 3: 최종 요약
         └─ final-summary — 전체 통합 요약

Stage 4: 고급 분석 (도메인별 선택)
         ├─ 병렬 그룹
         └─ 순차 그룹
```

### 도메인별 Stage 4

| 도메인    | 병렬 모듈                                               | 순차 모듈                                               |
| --------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 정치/정책 | approval-rating, frame-war                              | crisis-scenario, win-simulation                         |
| 팬덤      | fan-loyalty-index, fandom-narrative-war                 | fandom-crisis-scenario                                  |
| PR/기업   | crisis-type-classifier, reputation-index                | reputation-recovery-simulation                          |
| 기업 평판 | esg-sentiment, media-framing-dominance                  | csr-communication-gap                                   |
| 헬스케어  | health-risk-perception                                  | compliance-predictor                                    |
| 금융      | market-sentiment-index, information-asymmetry           | catalyst-scenario, investment-signal                    |
| 교육      | institutional-reputation-index, education-opinion-frame | education-crisis-scenario, education-outcome-simulation |

### AI 모델 어댑터

- `ModelConfigAdapter` — DB에서 모듈별 모델 설정 조회
- 프리셋(preset) 우선 적용 (관리자 설정)
- `PipelineControlAdapter` — 취소/일시정지/비용한도 제어

---

## 10. 데이터베이스 레이어

| 테이블             | 역할                |
| ------------------ | ------------------- |
| `collection_jobs`  | 분석 job 마스터     |
| `articles`         | 수집 기사/게시글    |
| `videos`           | 수집 영상           |
| `comments`         | 수집 댓글           |
| `analysis_results` | 모듈별 AI 분석 결과 |
| `report_sections`  | 최종 리포트         |
| `model_configs`    | AI 모델 설정        |
| `presets`          | 모델 프리셋         |
| `data_sources`     | 동적 수집 소스      |
| `ontology_*`       | 지식 그래프         |
| `pipeline_control` | 제어 플래그         |

---

## 11. 파이프라인 제어

| 기능      | DB                                 | 체크 위치        |
| --------- | ---------------------------------- | ---------------- |
| 취소      | `pipeline_control.cancelled`       | 매 청크, 매 배치 |
| 일시정지  | `pipeline_control.paused`          | 모듈 실행 전     |
| 비용한도  | `pipeline_control.cost_limit_usd`  | 모듈 실행 전     |
| 모듈 스킵 | `pipeline_control.skipped_modules` | 오케스트레이터   |

---

## 12. 전체 데이터 흐름 요약

```
사용자 트리거 (키워드+날짜+소스+도메인)
    ↓ tRPC mutation
collection_jobs 생성 (status: 'pending')
    ↓ triggerCollection()
BullMQ Flow (persist ← normalize-* ← collect-*)
    │
    ├─ collectors: 5개 소스 병렬 수집 (naver/youtube/dc/fm/clien)
    ├─ pipeline: 정규화 + 댓글 보충 수집
    ├─ pipeline: persist (DB 저장 + FK 무결성 + 임베딩 생성)
    └─ analysis: AI 분석
        ├─ Stage 0 → Stage 1(병렬) → Stage 2(혼합) → Stage 3 → Stage 4
        └─ 리포트 생성 → status='completed'

SSE 스트림이 전 과정 실시간 클라이언트 전달
```
