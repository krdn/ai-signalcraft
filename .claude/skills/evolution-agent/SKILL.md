---
name: evolution-agent
description: AI SignalCraft 시스템 자가 진화 에이전트 — 패턴 분석, 성능 회귀 감지, 개선 제안
---

# Evolution Agent

AI SignalCraft 시스템의 패턴을 분석하고, 성능 회귀를 감지하며, 개선 사항을 제안합니다.

## 분석 항목

### 1. 실패 패턴 분석 (DLQ)

```bash
# DLQ 항목 조회 (Redis)
dserver exec ais-prod-redis redis-cli -n 0 ZRANGE "bull:dlq:waiting" 0 -1
```

분석:

- 가장 빈번한 실패 원인
- 실패가 집중되는 시간대
- 특정 소스/모듈의 실패율

### 2. 파이프라인 성능 트렌드

```bash
# Redis에서 파이프라인 메트릭 조회
dserver exec ais-prod-redis redis-cli -n 0 ZRANGE "pipeline_metrics:stage_duration:normalization" -10 -1 WITHSCORES
dserver exec ais-prod-redis redis-cli -n 0 ZRANGE "pipeline_metrics:stage_duration:stage1" -10 -1 WITHSCORES
dserver exec ais-prod-redis redis-cli -n 0 ZRANGE "pipeline_metrics:stage_duration:stage2" -10 -1 WITHSCORES
```

각 스테이지의 최근 10개 실행 시간을 비교하여 20% 이상 저하 시 경고.

### 3. 토큰 사용량 분석

```bash
# Redis에서 토큰 사용량 조회
dserver exec ais-prod-redis redis-cli -n 0 ZRANGE "token_usage:daily" -7 -1 WITHSCORES
```

분석:

- 일별 토큰 사용량 추이
- 모듈별 토큰 소비량
- 비용 절감 기회 (모델 다운그레이드 후보)

### 4. 수집 효율 분석

```bash
dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c \
  "SELECT source, COUNT(*) as total,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))::numeric(10,1) as avg_duration_sec,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
  FROM collection_jobs
  WHERE created_at > now() - interval '7 days'
  GROUP BY source ORDER BY total DESC;"
```

### 5. 자동 수정 가능 항목

다음은 발견 시 자동으로 수정 가능:

- 누락된 DB 인덱스 (스키마에 index() 추가 후 db:push)
- `.catch(() => {})` → `logError()` 교체
- 에러 바운더리 누락 시 추가
- 의존성 마이너 버전 업데이트

**자동 수정 불가** (인간 리뷰 필수):

- 인증/권한 코드 변경
- 암호화 관련 코드
- API 키/시크릿 관련
- 스키마 마이그레이션 (컬럼 삭제/변경)

## 주간 리포트 형식

```markdown
# AI SignalCraft 주간 진화 리포트

## 기간: YYYY-MM-DD ~ YYYY-MM-DD

### 요약

- 분석 실행 수: N건
- 평균 파이프라인 소요 시간: N분
- 총 토큰 사용량: N토큰 (약 $N)
- 실패율: N%

### 성능 변화

| 스테이지      | 이전 평균 | 이번 주 평균 | 변화율 |
| ------------- | --------- | ------------ | ------ |
| normalization | N초       | N초          | +N%    |
| stage1        | N초       | N초          | +N%    |
| stage2        | N초       | N초          | +N%    |

### 비용 분석

| 모듈 | 모델 | 토큰 | 비용 | 절감 기회 |
| ---- | ---- | ---- | ---- | --------- |
| ...  | ...  | ...  | ...  | ...       |

### 실패 분석

- Top 3 실패 원인: ...
- 권장 조치: ...

### 자동 수정 내역

- [x] 수정 항목 1
- [ ] 대기 중인 수정 (인간 승인 필요)

### 다음 주 제안

1. ...
2. ...
```

## 실행 방법

- 수동: 이 스킬 호출
- 자동: 주간 `/schedule`로 실행 (예: 매주 월요일 9시)
- 제약: 보안 크리티컬 코드는 인간 리뷰 후에만 수정
