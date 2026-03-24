# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-24
**Phases:** 5 | **Plans:** 21 | **Commits:** 118

### What Was Built
- 6개 플랫폼 여론 수집 파이프라인 (네이버 뉴스/댓글, 유튜브, DC갤러리, 에펨코리아, 클리앙)
- 12개 AI 분석 모듈 (감성/프레임/전략/지지율/위기 시나리오 등) + 종합 리포트 자동 생성
- shadcn/ui 다크모드 대시보드 5탭 + 10개 시각화 컴포넌트 + AI 리포트 뷰어
- NextAuth v5 인증 + Resend 이메일 팀 초대 + RBAC 역할 관리
- 감사 기반 통합 갭 해소 (Phase 5)

### What Worked
- **Adapter Pattern**: 수집기 공통 인터페이스로 6개 소스 빠르게 확장 가능
- **BullMQ Flow 단순화**: 단일 runner가 내부 3단계 관리 → 디버깅 용이
- **AI SDK v6 Gateway**: 프로바이더 전환이 model 문자열 변경만으로 가능
- **마일스톤 감사 프로세스**: Phase 5 갭 해소로 통합 이슈 3건 사전 해결
- **Phase 속도**: 평균 5분/plan, 전체 MVP를 하루(~10시간)에 완성

### What Was Inefficient
- **ROADMAP.md 진행률 미동기화**: Phase 체크박스가 일부 미갱신 상태로 남음
- **pdf-exporter.ts 미활용**: 서버사이드 PDF 생성기를 구현했으나 결국 window.print() 사용
- **Phase 03-06 checkpoint**: 시각적 검증 Plan이 형식적으로만 존재
- **Nyquist compliance**: 5개 Phase 중 1개만 compliant — 테스트 커버리지 부족

### Patterns Established
- `AsyncGenerator` 청크 yield 패턴으로 수집기 메모리 효율화
- `buildPromptWithContext` + `prompt-utils`로 분석 프롬프트 재사용
- `serverExternalPackages` 설정으로 Node.js 전용 패키지 Next.js 번들링 방지
- `lazy 초기화` 패턴 (FlowProducer, Resend) — 빌드 시 외부 서비스 연결 방지
- `onConflictDoUpdate` upsert 패턴으로 중복 데이터 안전 처리

### Key Lessons
1. **감사를 마일스톤 끝에 돌려라**: Phase 5 갭 해소가 없었으면 소스 선택, 리포트 갱신, 초대 플로우 3곳이 깨진 채 출시
2. **window.print()가 PDF 내보내기에 충분**: 복잡한 서버사이드 PDF 생성보다 실용적
3. **AI SDK v6 모델 문자열이 핵심 추상화**: 프로바이더별 코드 분기 제거로 12개 모듈을 빠르게 구현
4. **커뮤니티 스크래핑은 articles 테이블 재사용 가능**: boardName→publisher 매핑으로 새 테이블 불필요
5. **테스트를 Phase마다 Nyquist 수준으로 유지해야 함**: v1.0은 테스트가 부족 → v1.1에서 보강 필요

### Cost Observations
- Model mix: 주로 Sonnet (분석 모듈), Opus (플래닝/코드리뷰)
- Timeline: 1일 (11:14 → 21:32 KST), 약 10시간
- Notable: 21 plans 평균 5분 — GSD executor 자동화로 높은 처리량

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 118 | 5 | 초기 MVP — GSD 워크플로우 + 마일스톤 감사 도입 |

### Cumulative Quality

| Milestone | LOC | Files | Tech Debt Items |
|-----------|-----|-------|-----------------|
| v1.0 | 24,443 | 271 | 13 (low-severity) |

### Top Lessons (Verified Across Milestones)

1. 마일스톤 감사 → 갭 해소 Phase가 통합 품질을 보장한다
2. (추가 마일스톤에서 검증 예정)
