# Quick Task 260327-vvl: 동일 분석실행 날짜 겹침 및 중복 기사 처리 전략 리서치

**Status:** Completed
**Date:** 2026-03-27

## 결과 요약

### 발견된 문제

- `persist.ts`의 `onConflictDoUpdate`에서 `jobId`를 마지막 job으로 덮어쓰는 것이 근본 원인
- 1:N 모델(기사→job)이 실제 도메인(N:M)과 불일치
- 날짜 겹치는 분석 실행 시 이전 job의 기사가 새 job으로 "이동"하여 데이터 무결성 파괴

### 권장 전략: 방안 B (다대다 조인 테이블)

1. **조인 테이블 도입**: `article_jobs`, `video_jobs`, `comment_jobs` 3개 생성
2. **persist 수정**: upsert에서 jobId 덮어쓰기 제거, 조인 레코드만 추가
3. **data-loader 수정**: JOIN 기반 조회로 변경
4. **사용자 경고**: 겹치는 job 존재 시 UI에서 소프트 경고 (차단은 하지 않음)

### 영향 범위

- 변경 대상: 6개 파일 (schema, persist, data-loader, router, migration)
- DB 마이그레이션: 조인 테이블 생성 → 기존 데이터 이전 → (선택) jobId 컬럼 제거
- 성능 영향: 미미 (소규모 데이터, 인덱스 사용)

### 상세 내용

→ `260327-vvl-RESEARCH.md` 참조

## Artifacts

- `.planning/quick/260327-vvl-duplicate-analysis-strategy/260327-vvl-RESEARCH.md`
- `.planning/quick/260327-vvl-duplicate-analysis-strategy/260327-vvl-PLAN.md`
