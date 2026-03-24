---
status: partial
phase: 01-foundation-core-data-collection
source: [01-VERIFICATION.md]
started: 2026-03-24T14:25:00Z
updated: 2026-03-24T14:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 운영 서버 DB 스키마 Push 확인
expected: 192.168.0.5:5436의 ai_signalcraft DB에 collection_jobs, articles, videos, comments 4개 테이블이 생성되어 있어야 한다
result: [pending]

### 2. 실제 네이버 뉴스 기사 수집 E2E 테스트
expected: 키워드 '윤석열'로 NaverNewsCollector를 실행하면 실제 기사 목록이 수집된다
result: [pending]

### 3. 네이버 댓글 파이프라인 E2E 테스트
expected: 기사 URL을 가진 기사 수집 결과로 normalize-naver 핸들러가 실행되면 collectForArticle()이 호출되어 실제 댓글이 DB에 저장된다
result: [pending]

### 4. YouTube API 수집 E2E 테스트
expected: YOUTUBE_API_KEY 설정 후 YoutubeVideosCollector 실행 시 영상 목록이 수집된다
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
