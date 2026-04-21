# 구독 수집 파이프라인에 개별 감정 분석 추가

**날짜**: 2026-04-21
**상태**: 승인 대기

## 배경

현재 구독 수집(collector 앱)은 raw_items에 원본 데이터를 적재만 하고, 감정 분석은 키워드 검색 시 수동 트리거하는 분석 파이프라인에서만 실행됩니다. 구독 수집 시점에 경량 BERT 모델로 감정 분석을 수행하면 API 비용 없이 실시간 여론 추적이 가능합니다.

## 접근법

collector 앱에 core의 기존 `sentiment-classifier` + 한국어 보정 로직을 통합합니다. 임베딩 생성 직후 같은 텍스트로 감정 분석을 실행합니다.

## 변경 사항

### 1. DB 스키마

`apps/collector/src/db/schema/items.ts` — raw_items에 2개 컬럼 추가:

```typescript
sentiment: text('sentiment'),            // 'positive' | 'negative' | 'neutral' | NULL
sentimentScore: real('sentiment_score'), // 0~1 확신도, NULL
```

- NULL 허용: 분석 실패/미실행 시 NULL 유지
- 인덱스 불필요: 기존 인덱스로 충분
- TimescaleDB 호환: ALTER TABLE ADD COLUMN으로 무방

### 2. 감정 분석 서비스

`apps/collector/src/services/sentiment.ts` — 신규 파일:

| 컴포넌트 | 출처 |
|---|---|
| `initSentiment()` | core `sentiment-classifier.ts` 재사용 |
| `classifySentiment()` | 동일 (배치 50, 타임아웃 30초) |
| `normalizeSentiment()` | 동일 (5 star → 3 label) |
| 한국어 보정 | core `korean-sentiment-rules.ts` 복사 |
| 반어/조롱 보정 | core `sarcasm-postprocess.ts` 복사 |

초기화: executor 첫 호출 시 lazy init (embedding.ts와 동일 패턴).
메모리: 워커당 ~120MB 증가 (BERT 모델).

### 3. executor.ts 변경

`executeCollectionJob()` 및 `executeCommentsJob()`의 청크 루프에 감정 분석 삽입:

```
chunk 수신 → mapToRawItem → embedPassages → classifySentiment → INSERT
```

- 임베딩용 텍스트(`buildEmbeddingText` 결과)를 감정 분석에 재사용
- 50개 단위 배치, 배치 사이 checkCancellation 호출
- 실패한 배치는 neutral/score 0 폴백, 전체 실패 시 NULL 유지

### 4. UI 표시

**LiveRunFeed**: 진행 요약에 감정 분포 추가
```
신규 기사 42 / 댓글 186 · 긍정 58% 부정 22% 중립 20%
```

**RecentRunsLog**: 완료된 run 행에 감정 아이콘 추가

**신규 tRPC 프로시저**: `runSentimentBreakdown(runId)` — raw_items에서 감정 집계

Redis progress에 감정 카운트 누적하여 실시간 폴링에 활용.

### 5. 에러 처리

| 상황 | 처리 |
|---|---|
| 모델 초기화 실패 | warn 로그 후 스킵, sentiment=NULL |
| 배치 타임아웃 | 해당 배치 neutral/score 0 |
| 전체 실패 | warn 로그, 수집 정상 완료 |
| cancellation | 배치 경계에서 즉시 중단 |

### 6. 마이그레이션

`pnpm db:push`로 컬럼 추가. 기존 데이터는 NULL 유지. 역방향 채움(backfill)은 별도 스크립트로 필요시 처리.

## 범위 밖

- AI 분석(Stage 1~4)은 수동 트리거 유지
- 정규화(normalize)는 core 파이프라인 유지
- 토큰 최적화는 AI 분석 전처리이므로 미포함
- 과거 데이터 backfill
- 시계열 감정 추이 대시보드
