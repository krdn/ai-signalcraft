# Milestones

## v1.0 MVP (Shipped: 2026-03-24)

**Phases completed:** 5 phases, 21 plans, 39 tasks

**Key accomplishments:**

- pnpm 모노리포 4개 패키지 구조 + Drizzle ORM으로 collection_jobs/articles/videos/comments 4개 테이블 스키마 정의
- BullMQ FlowProducer 3단계 파이프라인 오케스트레이터 + AsyncGenerator Collector 인터페이스 + AI SDK v6 기반 듀얼 프로바이더 게이트웨이
- Playwright+Cheerio 기반 NaverNewsCollector와 비공식 댓글 API 기반 NaverCommentsCollector 구현, AsyncGenerator 청크 yield 패턴 적용
- YouTube Data API v3로 영상 메타데이터(search+videos.list) + 댓글(commentThreads.list) 수집기를 Collector 인터페이스로 구현, 쿼터 효율 최적화
- 수집 데이터 정규화 + Drizzle onConflictDoUpdate upsert + BullMQ Worker 프로세스 + CLI 트리거로 전체 파이프라인 E2E 연결
- BullMQ Flow에서 collect-naver-comments 자식 작업을 제거하고, normalize-naver 핸들러에서 기사 URL 추출 후 collectForArticle()로 댓글을 직접 수집하는 파이프라인 통합
- analysisResults/analysisReports DB 스키마, AnalysisModule 인터페이스 계약, 데이터 로더/persist 함수, AI Gateway systemPrompt+usage 확장
- Stage 1 분석 모듈 4개 구현: 여론 구조/집단 세분화/감정 프레임/메시지 효과 분석 + Zod 스키마 + 한국어 프롬프트 빌더
- 리스크/기회/전략/최종요약 4개 분석 모듈 + Zod 스키마를 buildPromptWithContext 패턴으로 구현, Claude Sonnet 사용
- 3단계 병렬/순차 분석 러너 + BullMQ Flow 확장으로 수집-분석 파이프라인 자동 연결
- 8개 분석 모듈 결과를 AI로 통합하는 마크다운 종합 리포트 생성기와 Playwright 기반 PDF 내보내기 구현
- shadcn/ui + Tailwind 4 다크모드 기본 앱 셸, tRPC 11 라우터, NextAuth v5(Credentials+Google) 인증, Auth/Team DB 스키마 6개 테이블 설정
- 로그인/인증 미들웨어, 4탭 대시보드 셸, 분석 트리거 폼 + 4단계 파이프라인 모니터(3초 폴링), tRPC 라우터 3개(analysis/pipeline/history), 히스토리 테이블 구현
- 6개 시각화 컴포넌트(감성 Donut, 시계열 Line, 워드클라우드, 플랫폼 비교 Bar, 리스크/기회 카드) + 2열 반응형 그리드 대시보드 레이아웃으로 AI 분석 결과를 직관적으로 표시
- react-markdown + remark-gfm 기반 마크다운 리포트 뷰어, 좌측 섹션 네비게이션(IntersectionObserver), PDF 내보내기 버튼 구현
- Resend 이메일 기반 팀원 초대 + RBAC 역할 관리(Admin/Member) + 팀 ID 기반 분석 결과 격리 필터링
- Playwright+Cheerio 기반 커뮤니티(DC갤러리/에펨코리아/클리앙) 수집기 3종 + 정규화/파이프라인 통합
- 4개 고급 분석 모듈(AI 지지율/프레임 전쟁/위기 시나리오/승리 시뮬레이션) Zod 스키마 + Stage 4 파이프라인 통합
- 트리거 폼 커뮤니티 5종 소스 선택 + 고급 분석 탭(AI 지지율/프레임 전쟁/위기 시나리오/승리 시뮬레이션) 4개 시각화 컴포넌트
- 감사 갭 3건(INT-01, INT-02, FLOW-01) 해소 -- sources 선택적 수집, 리포트 upsert, callbackUrl 리다이렉트, acceptedAt DB 필터

---
