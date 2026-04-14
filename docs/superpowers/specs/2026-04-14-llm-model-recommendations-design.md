# LLM 모델 추천 문서 설계 스펙

**날짜**: 2026-04-14  
**목적**: AI SignalCraft 분석 모듈별 LLM 모델 추천 — 최고/보통/최소 티어  
**산출물**: `docs/llm-model-recommendations.md`

---

## 배경 및 목표

AI SignalCraft는 한국어 여론 데이터를 수집·분석하는 파이프라인으로, 현재 7개의 시나리오 프리셋(A~G)이 `model-config.ts`에 정의되어 있다. 이 문서는 2026년 4월 기준 LLM 시장 전체를 조사하여 각 분석 모듈에 최적화된 모델을 추천하고, 기존 프리셋을 업그레이드하는 근거 문서를 만드는 것을 목표로 한다.

---

## 설계 결정

| 항목               | 결정                                                          |
| ------------------ | ------------------------------------------------------------- |
| **문서 유형**      | 정적 마크다운 참고 문서 (`docs/llm-model-recommendations.md`) |
| **범위**           | 전체 LLM 시장 (시스템 미설치 모델 포함)                       |
| **티어 기준**      | 최고(품질 우선) / 보통(가성비) / 최소(비용 최소화)            |
| **문서 구조**      | Part 1: 시장 조사 / Part 2: 모듈 매트릭스 + 프리셋 업그레이드 |
| **핵심 선택 기준** | 한국어 성능 명시 (한국어 여론 분석이 핵심 사용 사례)          |

---

## Part 1 — 2026년 LLM 시장 분류

### 1.1 지원 프로바이더 (현재 시스템)

| 프로바이더 | 모델                   | 입력 ($/MTok) | 출력 ($/MTok) | 컨텍스트 | 한국어 | 구조화 출력 |
| ---------- | ---------------------- | ------------- | ------------- | -------- | ------ | ----------- |
| Anthropic  | Claude Opus 4.6        | $5.00         | $25.00        | 1M       | **상** | **상**      |
| Anthropic  | Claude Sonnet 4.6      | $3.00         | $15.00        | 1M       | **상** | **상**      |
| Anthropic  | Claude Haiku 4.5       | $1.00         | $5.00         | 200K     | **상** | **상**      |
| Google     | Gemini 2.5 Pro         | $1.25~$2.50   | $10.00~$15.00 | 1M       | **상** | **상**      |
| Google     | Gemini 2.5 Flash       | $0.30         | $2.50         | 1M       | **상** | **상**      |
| Google     | Gemini 2.5 Flash-Lite  | $0.10         | $0.40         | 1M       | 중     | 중          |
| OpenAI     | GPT-4.1                | $2.00         | $8.00         | 1M       | **상** | **상**      |
| OpenAI     | GPT-4.1 Mini           | $0.40         | $1.60         | 128K     | **상** | **상**      |
| OpenAI     | GPT-4.1 Nano           | $0.10         | $0.40         | 128K     | 중     | 중          |
| OpenAI     | o3                     | $2.00         | $8.00         | 200K     | **상** | **상**      |
| OpenAI     | o4-mini                | $1.10         | $4.40         | 200K     | **상** | **상**      |
| DeepSeek   | DeepSeek V3 (Chat)     | $0.07 (캐시)  | $1.10         | 128K     | 중     | 중          |
| DeepSeek   | DeepSeek V4 (최신)     | $0.03 (캐시)  | $0.50         | 128K     | 중     | 중          |
| DeepSeek   | DeepSeek R1 (Reasoner) | $0.14 (캐시)  | $2.19         | 128K     | 중     | 중          |

> DeepSeek 캐시 히트 시 입력 비용 90% 절감 (공통 시스템 프롬프트 재활용 많은 파이프라인에 유리)

### 1.2 확장 프로바이더 (OpenRouter 경유)

| 프로바이더 | 모델             | 입력 ($/MTok) | 출력 ($/MTok) | 컨텍스트 | 한국어 | 구조화 출력 |
| ---------- | ---------------- | ------------- | ------------- | -------- | ------ | ----------- |
| Meta       | Llama 4 Maverick | $0.15         | $0.60         | **1M**   | 중     | 중          |
| Meta       | Llama 3.3 70B    | $0.10         | $0.32         | 65K      | 중     | 중          |
| Alibaba    | Qwen3.6 Plus     | $0.33         | $1.95         | 128K     | 중~상  | 중          |
| Alibaba    | Qwen2.5-72B      | $0.12         | $0.39         | 32K      | 중~상  | 중          |
| Mistral    | Mistral Large 3  | $0.50         | $1.50         | 262K     | 하     | 중          |
| Mistral    | Mistral Small 4  | $0.15         | $0.60         | 262K     | 하     | 중          |
| xAI        | Grok-3           | $3.00         | $15.00        | 131K     | 중     | 중          |
| xAI        | Grok-3 Mini      | $0.30         | $0.50         | 131K     | 중     | 중          |

> OpenRouter 사용 시 ai-gateway에 `openrouter` 프로바이더 추가 필요

### 1.3 기타 프로바이더 (AWS Bedrock 경유)

| 프로바이더 | 모델       | 입력 ($/MTok) | 출력 ($/MTok) | 컨텍스트 | 한국어 | 비고             |
| ---------- | ---------- | ------------- | ------------- | -------- | ------ | ---------------- |
| Amazon     | Nova Pro   | $0.80         | $3.20         | 300K     | 중~상  | AWS Bedrock 전용 |
| Amazon     | Nova Lite  | $0.06         | $0.24         | 300K     | 중     | AWS Bedrock 전용 |
| Amazon     | Nova Micro | $0.035        | $0.14         | 128K     | 중     | AWS Bedrock 전용 |

> AWS Bedrock은 별도 계정 및 SDK 통합 필요 — 현재 시스템과 통합 공수 높음

### 1.4 한국어 성능 종합 순위

한국어 여론 분석에서 뉘앙스·감정·맥락 파악 능력 기준:

```
상위권 (운영 추천): Claude Sonnet/Opus > GPT-4.1 > Gemini 2.5 Pro/Flash
중위권 (보조 가능): Qwen3.x > Nova Pro > GPT-4.1 Mini > Gemini Flash-Lite
하위권 (단순 분류만): DeepSeek V3/V4 > Grok-3 > Llama 4 > Mistral
```

**선택 원칙**:

- 한국어 뉘앙스 정확도: Claude 계열 > GPT-4.1 > Gemini (3강 외 격차 큼)
- 구조화 출력 신뢰성: Claude = GPT-4.1 = Gemini Flash/Pro > 나머지
- 비용 효율 (캐싱 포함): DeepSeek V4 > Gemini Flash-Lite > Haiku 4.5 > Flash
- 긴 컨텍스트(32K+): Claude 전체, Gemini 전체, GPT-4.1, Llama 4 Maverick 적합

---

## Part 2 — 분석 모듈별 추천 매트릭스

### 2.1 모듈 그룹 분류

분석 모듈을 특성에 따라 3개 그룹으로 분류한다.

| 그룹                              | 모듈                                                                              | 요구 특성                               |
| --------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| **A — 구조 분석** (Stage 1, 병렬) | `macro-view`, `segmentation`, `sentiment-framing`, `message-impact`               | 넓은 컨텍스트 처리, 한국어 이해력       |
| **B — 전략 심화** (Stage 2, 순차) | `risk-map`, `opportunity`, `strategy`, `final-summary`                            | 추론 능력, 이전 결과 통합, 긴 출력 품질 |
| **C — 고급 시뮬레이션** (Stage 4) | `approval-rating`, `frame-war`, `crisis-scenario`, `win-simulation` + 도메인 모듈 | 복잡한 시나리오 추론, 창의적 생성       |

### 2.2 그룹별 티어 추천

#### 그룹 A — 구조 분석 (Stage 1)

| 티어          | 추천 모델             | 예상 비용        | 선택 이유                                         |
| ------------- | --------------------- | ---------------- | ------------------------------------------------- |
| **최고**      | Gemini 2.5 Pro        | ~$1.25~2.50/MTok | 1M 컨텍스트, 낮은 할루시네이션(0.7%), 한국어 상급 |
| **보통**      | Gemini 2.5 Flash      | ~$0.30/MTok      | 속도·비용 균형, 1M 컨텍스트, 한국어 상급          |
| **최소**      | Gemini 2.5 Flash-Lite | ~$0.10/MTok      | 초저가, 배치 모드 시 $0.05/MTok, 단순 분류 가능   |
| **대안 최고** | Claude Sonnet 4.6     | ~$3.00/MTok      | 한국어 최고 수준, JSON 신뢰성 최상                |
| **대안 최소** | GPT-4.1 Nano          | ~$0.10/MTok      | 영문 기반 단순 분류, 한국어 제한적                |

#### 그룹 B — 전략 심화 (Stage 2)

| 티어          | 추천 모델         | 예상 비용          | 선택 이유                                      |
| ------------- | ----------------- | ------------------ | ---------------------------------------------- |
| **최고**      | Claude Opus 4.6   | ~$5.00/MTok        | 최고 지능, 복잡한 추론, 한국어 최상            |
| **보통**      | Claude Sonnet 4.6 | ~$3.00/MTok        | 품질·비용 균형 최적, 한국어 상급, 캐싱 효과 큼 |
| **최소**      | DeepSeek R1       | ~$0.14/MTok (캐시) | 추론 특화, 초저가, 단 한국어 뉘앙스 한계 있음  |
| **대안 최고** | GPT-4.1           | ~$2.00/MTok        | 한국어 상급, 1M 컨텍스트, 구조화 출력 안정     |
| **대안 보통** | o4-mini           | ~$1.10/MTok        | 추론 특화, o3 대비 절반 가격                   |

#### 그룹 C — 고급 시뮬레이션 (Stage 4)

| 티어          | 추천 모델         | 예상 비용   | 선택 이유                                              |
| ------------- | ----------------- | ----------- | ------------------------------------------------------ |
| **최고**      | Claude Opus 4.6   | ~$5.00/MTok | 복잡한 시나리오 최적, 한국어 최상                      |
| **보통**      | Claude Sonnet 4.6 | ~$3.00/MTok | 시뮬레이션 품질 충분, 비용 합리적                      |
| **최소**      | Claude Haiku 4.5  | ~$1.00/MTok | 200K 컨텍스트, 한국어 상급, 고속 처리                  |
| **대안 최고** | o4-mini           | ~$1.10/MTok | 추론 특화 시뮬레이션, 상대적 저비용                    |
| **대안 미래** | Grok-3            | ~$3.00/MTok | X(트위터) 실시간 데이터 연동 가능성 (현재 한국어 중급) |

### 2.3 전체 모듈별 추천 매트릭스

| 모듈                           | 최고              | 보통              | 최소                    |
| ------------------------------ | ----------------- | ----------------- | ----------------------- |
| `macro-view`                   | Gemini 2.5 Pro    | Gemini 2.5 Flash  | Gemini Flash-Lite       |
| `segmentation`                 | Gemini 2.5 Pro    | Gemini 2.5 Flash  | GPT-4.1 Nano            |
| `sentiment-framing`            | Claude Sonnet 4.6 | Gemini 2.5 Flash  | Gemini Flash-Lite       |
| `message-impact`               | Claude Sonnet 4.6 | GPT-4.1 Mini      | Gemini Flash-Lite       |
| `risk-map`                     | Claude Opus 4.6   | Claude Sonnet 4.6 | DeepSeek R1             |
| `opportunity`                  | Claude Opus 4.6   | Claude Sonnet 4.6 | DeepSeek R1             |
| `strategy`                     | Claude Opus 4.6   | Claude Sonnet 4.6 | DeepSeek V4 (캐시 활용) |
| `final-summary`                | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5        |
| `approval-rating`              | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5        |
| `frame-war`                    | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5        |
| `crisis-scenario`              | Claude Opus 4.6   | o4-mini           | Claude Haiku 4.5        |
| `win-simulation`               | Claude Opus 4.6   | o4-mini           | Claude Haiku 4.5        |
| `fan-loyalty-index`            | Claude Sonnet 4.6 | Gemini 2.5 Flash  | Claude Haiku 4.5        |
| `fandom-narrative-war`         | Claude Sonnet 4.6 | Gemini 2.5 Flash  | Claude Haiku 4.5        |
| `fandom-crisis-scenario`       | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5        |
| `release-reception-prediction` | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5        |

> **도메인 전용 Stage 4 모듈** (corporate, healthcare, sports, finance, education, pr): 위 그룹 C 기준 동일 적용

---

## Part 3 — 시나리오 프리셋 업그레이드 제안

### 3.1 현재 시나리오 평가

| 시나리오             | 현재 구성                            | 평가                                | 업그레이드 우선순위 |
| -------------------- | ------------------------------------ | ----------------------------------- | ------------------- |
| A: 최고 품질         | Stage1=Gemini 2.5 Pro, 전략=Opus 4.6 | 유효 — 거의 최적                    | 낮음                |
| B: 가성비 최적       | Stage1=Flash, 전략=Haiku             | 유효 — Flash-Lite 활용 가능         | 중간                |
| C: 초저가            | Stage1=GPT-4.1 Nano, Stage2=Flash    | 유효 — DeepSeek V4로 추가 절감 가능 | 중간                |
| D: Gemini CLI 무료   | Gemini CLI OAuth                     | 유효 — 무료 쿼터 주의               | 낮음                |
| E: 완전 무료         | Gemini CLI 전체                      | 유효                                | 낮음                |
| F: Claude+Gemini CLI | CLI 혼합                             | 유효                                | 낮음                |
| G: DeepSeek 혼합     | Stage1=DeepSeek Chat, 전략=Sonnet    | **개선 필요** — DeepSeek V4로 교체  | **높음**            |

### 3.2 신규 시나리오 제안

#### 시나리오 H: 2026 추론 특화 (신규)

> Stage 1 = Gemini 2.5 Flash, Stage 2 = Claude Sonnet 4.6, Stage 4 = o4-mini  
> 예상 비용: ~$0.45/실행 | 추론 품질 최적화, 시뮬레이션 정확도 향상

#### 시나리오 I: OpenRouter 초저가 (신규, 미래 확장)

> Stage 1 = Llama 4 Maverick, Stage 2 = Qwen3.6 Plus, Stage 4 = Gemini 2.5 Flash  
> 예상 비용: ~$0.08/실행 | OpenRouter 프로바이더 통합 필요

### 3.3 시나리오 G 업그레이드 (즉시 적용 가능)

```typescript
// 현재 G: DeepSeek Chat → 개선: DeepSeek V4 (캐시 히트 $0.03/MTok)
'macro-view':      { provider: 'deepseek', model: 'deepseek-chat' }  // 현재
'macro-view':      { provider: 'deepseek', model: 'deepseek-v4' }    // 개선 (43% 추가 절감)
```

---

## 구현 범위 (이 스펙의 산출물)

1. `docs/llm-model-recommendations.md` 작성 — 위 내용을 실용적 참고 문서로 정리
2. 코드 변경 없음 — 문서만 작성 (프리셋 코드 반영은 별도 작업)
3. `.gitignore`에 `.superpowers/` 추가 확인

---

## 제외 범위

- `model-config.ts` 코드 변경 (별도 결정 사항)
- OpenRouter 프로바이더 통합 개발
- AWS Bedrock 통합
- 자동화된 모델 벤치마크 테스트
