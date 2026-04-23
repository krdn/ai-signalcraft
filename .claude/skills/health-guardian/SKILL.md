---
name: health-guardian
description: AI SignalCraft 시스템 헬스체크 및 자가 복구 에이전트
---

# Health Guardian

AI SignalCraft 시스템의 건강 상태를 점검하고, 문제를 감지하여 자가 복구를 수행합니다.

## 점검 항목

### 1. BullMQ 큐 상태

```bash
# Redis에서 큐 상태 확인 (운영 서버)
dserver exec ais-prod-redis redis-cli -n 0 KEYS "bull:*"
dserver exec ais-prod-redis redis-cli -n 0 LLEN "bull:collectors:wait"
dserver exec ais-prod-redis redis-cli -n 0 LLEN "bull:pipeline:wait"
dserver exec ais-prod-redis redis-cli -n 0 LLEN "bull:analysis:wait"
dserver exec ais-prod-redis redis-cli -n 0 ZCARD "bull:collectors:delayed"
dserver exec ais-prod-redis redis-cli -n 0 ZCARD "bull:analysis:delayed"
```

웹 API로 확인 (로컬에서 실행):

```bash
curl -s http://localhost:3300/api/metrics 2>/dev/null | head -50
```

### 2. Worker 프로세스 상태

```bash
dserver ps --filter name=ais-prod --format "table {{.Names}}\t{{.Status}}"
```

확인 항목:

- ais-prod-web, ais-prod-worker 컨테이너가 Running 상태인지
- Worker 프로세스가 Redis에 연결되어 있는지
- 최근 로그에 에러가 없는지

### 3. 좀비 잡 탐지

```bash
# running 상태가 30분 이상 지속된 잡 확인
dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c \
  "SELECT id, keyword, status, updated_at FROM collection_jobs WHERE status='running' AND updated_at < now() - interval '30 minutes' ORDER BY updated_at;"
```

### 4. DB 헬스체크

```bash
dserver exec ais-prod-postgres pg_isready
dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c \
  "SELECT pg_size_pretty(pg_database_size('ai_signalcraft')) as db_size, (SELECT count(*) FROM collection_jobs) as total_jobs;"
```

### 5. Redis 헬스체크

```bash
dserver exec ais-prod-redis redis-cli INFO memory | grep used_memory_human
dserver exec ais-prod-redis redis-cli INFO clients | grep connected_clients
dserver exec ais-prod-redis redis-cli DBSIZE
```

### 6. 디스크 공간

```bash
ssh gon@192.168.0.5 df -h / | tail -1
```

## 자가 복구 액션

### 좀비 잡 복구

running 상태가 30분 이상인 잡이 발견되면:

```bash
# failed로 상태 변경
dserver exec ais-prod-postgres psql -U ais -d ai_signalcraft -c \
  "UPDATE collection_jobs SET status='failed', error_details=jsonb_build_object('recovery', 'zombie_detected'), updated_at=now() WHERE status='running' AND updated_at < now() - interval '30 minutes';"
```

### 워커 재시작

컨테이너가 비정상이면:

```bash
dserver restart ais-prod-worker
```

## 결과 보고

모든 점검 완료 후 JSON 형식으로 결과 요약:

```json
{
  "timestamp": "2026-04-23T...",
  "status": "healthy|degraded|critical",
  "checks": {
    "queues": { "status": "ok", "depth": {...} },
    "workers": { "status": "ok", "containers": [...] },
    "zombie_jobs": { "status": "ok", "count": 0 },
    "database": { "status": "ok", "size": "..." },
    "redis": { "status": "ok", "memory": "..." },
    "disk": { "status": "ok", "usage": "..." }
  },
  "actions_taken": [...]
}
```

## 실행 방법

- 수동: 이 스킬 호출
- 자동: `/loop 30m /health-guardian` 또는 `/schedule`로 30분 간격 실행
