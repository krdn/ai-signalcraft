# Quick Task 260325-rht: 분석 실행 유튜브 테스트

**Completed:** 2026-03-25
**Status:** 문제 발견 (YouTube API 키 인증 실패)

## 테스트 결과

### 환경 점검 (PASS)
- ✅ 환경변수 설정 확인 (YOUTUBE_API_KEY, DATABASE_URL, REDIS_URL)
- ✅ Redis 연결 (192.168.0.5:6380 PONG)
- ✅ Next.js 서버 (localhost:3000, 307 응답)
- ✅ BullMQ Worker 프로세스 실행 중

### 유튜브 파이프라인 테스트 (FAIL)
- ✅ 분석 실행 화면에서 유튜브 소스 선택 가능
- ✅ 키워드 "윤석열" 입력 후 분석 실행 버튼 활성화
- ✅ 분석 트리거 성공 (job 생성됨)
- ✅ BullMQ Flow 구조 정상 (collect-youtube-videos, collect-youtube-comments 작업 생성)
- ❌ **YouTube 수집 실패**: `Login Required` 에러
- ✅ 부분 실패 허용으로 분석 파이프라인은 계속 진행됨

### 근본 원인

`apps/web/.env.local`의 `YOUTUBE_API_KEY`가 **YouTube Data API v3용 API 키가 아님**.

직접 API 호출 테스트 결과:
```
ERROR - API keys are not supported by this API. Expected OAuth2 access token
or other authentication credentials that assert a principal.
```

이는 현재 설정된 키가 다른 Google API(예: Gemini/AI Studio)용 키로, YouTube Data API v3가 활성화된 GCP 프로젝트의 API 키가 아님을 의미합니다.

### 해결 방법

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. GCP 프로젝트에서 **YouTube Data API v3** 활성화
3. "API 및 서비스 > 사용자 인증 정보"에서 **API 키** 생성 (YouTube Data API v3용)
4. `apps/web/.env.local`의 `YOUTUBE_API_KEY` 값을 새 키로 교체

### 코드 품질 확인

- 파이프라인 코드 자체는 정상 (수집기, Flow 구조, Worker, 부분 실패 처리 모두 올바르게 동작)
- API 키만 유효한 것으로 교체하면 YouTube 수집이 정상 동작할 것으로 예상

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| - | - | - | 코드 변경 없는 수동 테스트이므로 해당 없음 |

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 코드 작성 작업 아님 (수동 테스트) |
| superpowers:test-driven-development | 코드 변경 없음 |
| superpowers:systematic-debugging | 환경 설정 문제로 코드 버그 아님 |
| superpowers:requesting-code-review | 코드 변경 없음 |
