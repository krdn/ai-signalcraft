# Quick Task: GitHub Actions CI/CD 파이프라인

## Goal

PR 시 자동 검증(lint, build, typecheck) + main 머지 시 운영 서버(192.168.0.5) Docker 배포

## Tasks

### Task 1: CI 워크플로우 (PR 검증)

- `.github/workflows/ci.yml` 생성
- PR/push 시 lint, typecheck, build 실행
- pnpm 캐싱으로 속도 최적화

### Task 2: CD 워크플로우 (배포)

- `.github/workflows/deploy.yml` 생성
- main 머지 시 SSH로 운영 서버 배포
- Docker Compose 기반 배포

### Task 3: Dockerfile + docker-compose.prod.yml

- 멀티스테이지 Dockerfile (web + worker)
- Production docker-compose

### Task 4: 루트 package.json에 lint/typecheck 스크립트 추가
