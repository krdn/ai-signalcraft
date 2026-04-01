---
phase: quick
plan: 260325-rht
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
must_haves:
  truths:
    - 'YouTube 수집 파이프라인이 API Key로 정상 인증됨'
    - '분석 실행 화면에서 YouTube 소스 선택 후 트리거가 동작함'
    - 'collect-youtube-videos, collect-youtube-comments 작업이 BullMQ에서 처리됨'
  artifacts: []
  key_links:
    - from: 'apps/web TriggerForm'
      to: 'packages/core/src/queue/flows.ts triggerCollection'
      via: 'tRPC analysis.trigger mutation'
      pattern: 'triggerCollection'
---

<objective>
분석 실행 화면에서 유튜브 소스를 선택하고 실제 파이프라인을 트리거하여 유튜브 수집 -> 분석 과정이 정상 동작하는지 수동 테스트한다.

Purpose: 유튜브 수집기가 실제 YouTube Data API와 연결되어 동작하는지 E2E로 확인
Output: 테스트 결과 확인 (코드 변경 없음)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/core/src/queue/flows.ts
@packages/core/src/queue/worker-process.ts
@packages/collectors/src/adapters/youtube-videos.ts
@packages/collectors/src/adapters/youtube-comments.ts
@apps/web/src/components/analysis/trigger-form.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: 개발 환경 기동 및 사전 점검</name>
  <files></files>
  <action>
    1. 환경변수 확인: apps/web/.env.local에 YOUTUBE_API_KEY, DATABASE_URL, REDIS_URL이 설정되어 있는지 확인
    2. Redis 연결 확인: redis-cli -h 192.168.0.5 -p 6380 ping → PONG 응답 확인
    3. PostgreSQL 연결 확인: psql로 signalcraft DB 접속 가능 여부 확인
    4. 개발 서버 기동: `pnpm dev:all` 실행 (Next.js dev + BullMQ worker 동시 기동)
       - Next.js가 http://localhost:3000 에서 응답하는지 확인
       - Worker 프로세스가 정상 시작되어 큐를 리스닝하는지 로그 확인
    5. 브라우저에서 http://localhost:3000 접속하여 분석 실행 페이지 로딩 확인
  </action>
  <verify>
    <automated>curl -s -o /dev/null -w "%{http_code}" http://localhost:3000</automated>
  </verify>
  <done>Next.js 200 응답, Worker 프로세스 실행 중, Redis/PostgreSQL 연결 정상</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>개발 서버 + BullMQ Worker가 기동된 상태에서 유튜브 수집 파이프라인을 실제로 트리거합니다.</what-built>
  <how-to-verify>
    1. 브라우저에서 http://localhost:3000 접속 → 분석 실행 화면으로 이동
    2. 키워드 입력 (예: "윤석열" 또는 테스트용 키워드)
    3. 데이터 소스에서 "유튜브"만 선택 (다른 소스 체크 해제)
    4. 날짜 범위 설정 (최근 7일 등)
    5. "분석 실행" 버튼 클릭
    6. PipelineMonitor에서 파이프라인 진행 상태 확인:
       - collect-youtube-videos 작업이 시작되고 완료되는지
       - collect-youtube-comments 작업이 시작되고 완료되는지
       - normalize-youtube 단계가 진행되는지
       - persist 단계가 완료되는지
    7. 터미널의 Worker 로그에서 YouTube API 호출 및 데이터 수집 로그 확인
    8. 에러 발생 시: 에러 메시지 확인 (API 키 문제, quota 초과, 네트워크 등)
  </how-to-verify>
  <resume-signal>"approved" (정상 동작) 또는 발견된 문제 설명</resume-signal>
</task>

</tasks>

<verification>
- YouTube 수집기가 API Key로 인증하여 실제 데이터를 가져옴
- BullMQ Flow가 collect -> normalize -> persist 순서로 정상 진행
- PipelineMonitor UI에서 진행 상태가 실시간으로 업데이트됨
</verification>

<success_criteria>
유튜브 소스를 선택한 분석 실행이 에러 없이 완료되거나, 발견된 문제가 명확히 식별됨
</success_criteria>

<output>
After completion, create `.planning/quick/260325-rht-youtube-test/260325-rht-SUMMARY.md`
</output>
