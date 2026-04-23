---
name: quality-inspector
description: AI SignalCraft 코드 품질 자동 검사 에이전트
---

# Quality Inspector

AI SignalCraft 코드베이스의 품질을 자동 검사하고 결과를 보고합니다.

## 검사 항목

### 1. 테스트 실행

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm test 2>&1 | tail -30
```

결과에서 추출:

- 총 테스트 수, 통과/실패/스킵 수
- 실패한 테스트 이름과 에러 메시지

### 2. 린트 검사

```bash
pnpm lint 2>&1 | tail -30
```

심각도별 분류:

- ERROR: 즉시 수정 필요
- WARN: 권장 수정
- 기존 대비 신규 에러 여부

### 3. 안티패턴 스캔

```bash
# .catch(() => {}) 패턴 (에러 무시)
grep -rn "\.catch(() => {})" packages/core/src/ --include="*.ts" | grep -v node_modules | wc -l

# .catch(() => void 0) 패턴
grep -rn "\.catch(() => void 0)" packages/core/src/ --include="*.ts" | grep -v node_modules | wc -l

# sql.raw() 패턴 (SQL 인젝션 위험)
grep -rn "sql\.raw(" packages/core/src/ --include="*.ts" | wc -l

# any 타입 사용
grep -rn ": any" apps/web/src/ --include="*.ts" --include="*.tsx" | wc -l
```

### 4. 의존성 감사

```bash
pnpm audit --audit-level moderate 2>&1 | tail -20
```

### 5. 에러 바운더리 확인

```bash
find apps/web/src/app -name "error.tsx" | wc -l
```

최소 6개 이상이어야 함 (app, dashboard, subscriptions, reports, admin, sales).

### 6. 타입 체크

```bash
npx tsc --noEmit -p packages/core/tsconfig.json 2>&1
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1
npx tsc --noEmit -p packages/collectors/tsconfig.json 2>&1
```

### 7. 스키마 동기화 확인

```bash
# Drizzle 스키마 파일 변경 여부 확인 (마지막 db:push 이후)
git diff HEAD -- packages/core/src/db/schema/ | head -30
```

## 결과 보고

```json
{
  "timestamp": "...",
  "overall": "pass|fail|warning",
  "categories": {
    "tests": { "status": "pass|fail", "total": 0, "passed": 0, "failed": 0, "skipped": 0 },
    "lint": { "status": "pass|fail", "errors": 0, "warnings": 0 },
    "antipatterns": { "silent_catch": 0, "sql_raw": 0, "any_type": 0 },
    "security": { "vulnerabilities": 0 },
    "typecheck": { "status": "pass|fail", "errors": 0 },
    "error_boundaries": { "status": "pass|fail", "count": 0 }
  },
  "issues": [...],
  "recommendations": [...]
}
```

## 실행 방법

- 수동: 이 스킬 호출
- 자동: 야간 스케줄 `/schedule`로 실행
