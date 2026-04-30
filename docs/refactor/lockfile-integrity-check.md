# Lockfile 정합성 점검 (PR 1-D)

**작성일**: 2026-04-30
**범위**: `pnpm-lock.yaml`의 git 의존성 commit SHA 잠금 검증
**결론**: 정합성 OK — git 의존성 1건 잠금 확인. 별도 코드 변경 없음.

---

## 검증 대상

본 프로젝트는 `@krdn/ai-analysis-kit`을 git tag로 의존:

```json
"@krdn/ai-analysis-kit": "git+https://github.com/krdn/ai-analysis-kit.git#v2.0.1"
```

태그는 가변 참조이므로(이론상 force-push 가능) lockfile에 commit SHA 잠금이 필수.

## 검증 결과

### lockfile 잠금 상태

`pnpm-lock.yaml`에서 다음과 같이 commit SHA로 잠금 확인:

```yaml
'@krdn/ai-analysis-kit':
  specifier: git+https://github.com/krdn/ai-analysis-kit.git#v2.0.1
  version: https://codeload.github.com/krdn/ai-analysis-kit/tar.gz/ff65870de9aba076ccda8d22b49a6d83c9528abc(...)
```

```yaml
'@krdn/ai-analysis-kit@https://codeload.github.com/krdn/ai-analysis-kit/tar.gz/ff65870de9aba076ccda8d22b49a6d83c9528abc':
  resolution:
    {
      tarball: https://codeload.github.com/krdn/ai-analysis-kit/tar.gz/ff65870de9aba076ccda8d22b49a6d83c9528abc,
    }
  version: 2.0.1
  engines: { node: '>=20' }
```

### GitHub 측 검증

GitHub API로 v2.0.1 태그가 가리키는 commit SHA 확인:

```bash
$ curl -sL "https://api.github.com/repos/krdn/ai-analysis-kit/commits/v2.0.1" | grep '"sha"'
  "sha": "ff65870de9aba076ccda8d22b49a6d83c9528abc",
```

**lockfile SHA와 GitHub commit SHA가 정확히 일치** → 잠금 정합.

## 운영 상 의미

- **CI/CD에서 `pnpm install --frozen-lockfile`** 실행 시 동일한 tarball 다운로드 보장
- 만약 누군가 GitHub에서 v2.0.1 태그를 다른 commit으로 force-update해도 lockfile이 SHA로 잠겨 있어 영향 없음
- 의도적으로 새 버전을 받으려면 `package.json`에서 `#v2.0.2` 등으로 명시 변경 + `pnpm install` 필요

## 권장 사항

### 정기 점검 항목

1. **새 git 의존성 추가 시**: lockfile에 commit SHA가 잠겼는지 확인
2. **lockfile 충돌 해결 시**: SHA가 의도한 버전을 가리키는지 검증 (`pnpm install` 후 diff 확인)
3. **CI 검증**: `pnpm install --frozen-lockfile` PASS 여부

### 향후 강화 방안 (별도 작업)

- pre-commit hook으로 `pnpm-lock.yaml`이 stage된 경우 git 의존성 SHA 일관성 체크
- Renovate/Dependabot 설정으로 git tag 의존성 자동 업데이트 PR 생성

## 다른 의존성 점검

`apps/web/package.json`, `packages/core/package.json`, `apps/collector/package.json`을 검토한 결과 git 의존성은 `@krdn/ai-analysis-kit` 1건뿐. 나머지는 모두 npm registry 의존이므로 SemVer 정상 잠금.

`workspace:*` 의존성(`@ai-signalcraft/core`, `@ai-signalcraft/collectors` 등)은 monorepo 내부 참조로 lockfile에 별도 SHA 불필요.

---

## 결과 요약

| 항목                                    | 상태    |
| --------------------------------------- | ------- |
| git 의존성 SHA 잠금                     | ✅ OK   |
| 잠금 SHA = GitHub 측 SHA                | ✅ 일치 |
| `pnpm install --frozen-lockfile` 재현성 | ✅ 보장 |

본 PR은 검증 보고서만 추가하며 코드/lockfile 변경 없음.
