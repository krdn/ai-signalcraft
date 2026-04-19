# @ai-signalcraft/collector

AI SignalCraft 수집 시스템 — 키워드 구독 기반 지속 수집 서비스.

## 역할

- 키워드 "구독"을 관리하고, 등록된 키워드를 스케줄러가 주기적으로 수집
- 5개 소스(naver-news, youtube, dcinside, fmkorea, clien)에서 원본 데이터 적재
- TimescaleDB 하이퍼테이블에 원본 + 임베딩 저장
- 분석 시스템(ai-signalcraft/web)에는 tRPC HTTP API만 노출

## 포트

`3400` (기본값, `PORT` 환경변수로 변경 가능)

## 주요 명령어

```bash
pnpm --filter @ai-signalcraft/collector dev          # 개발 서버
pnpm --filter @ai-signalcraft/collector worker       # 수집 BullMQ 워커
pnpm --filter @ai-signalcraft/collector scheduler    # 구독 스케줄러
pnpm --filter @ai-signalcraft/collector db:push      # Drizzle 스키마 동기화
pnpm --filter @ai-signalcraft/collector db:migrate-timescale  # 하이퍼테이블 생성
```

## 환경 변수

`.env.example` 참고. 운영 배포 시 `COLLECTOR_API_KEY`는 반드시 무작위 값으로 설정.

## 통신 방식

ai-signalcraft/web → `Authorization: Bearer $COLLECTOR_API_KEY` 헤더로 tRPC 호출.
