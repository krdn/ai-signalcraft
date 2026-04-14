# AI SignalCraft — LLM 모델 추천 가이드

> **최종 업데이트**: 2026-04-14  
> **목적**: 분석 모듈별 LLM 모델 추천 (최고/보통/최소 티어) 및 시나리오 프리셋 업그레이드 근거  
> **기준**: 한국어 여론 분석 성능, 비용 효율, 구조화 출력 신뢰성

---

## Part 1 — 2026년 LLM 시장 분류

### 한국어 성능 평가 기준

이 문서의 **한국어** 등급은 한국어 여론 분석 맥락 기준이다:

- **상**: 뉘앙스·감정·맥락 파악 우수, 운영 환경 추천
- **중**: 기본 분류·요약 가능, 복잡한 뉘앙스 제한적
- **하**: 한국어 학습 데이터 부족, 단순 작업만 가능

### 1.1 지원 프로바이더 (현재 시스템)

현재 `ai-gateway`에서 직접 지원하는 프로바이더.

| 프로바이더 | 모델                   |    입력 ($/MTok)     | 출력 ($/MTok) | 컨텍스트 | 한국어 | 구조화 출력 | 비고                                           |
| ---------- | ---------------------- | :------------------: | :-----------: | :------: | :----: | :---------: | ---------------------------------------------- |
| Anthropic  | Claude Opus 4.6        |        $5.00         |    $25.00     |    1M    | **상** |   **상**    | 최고 지능, 복잡한 추론 최적                    |
| Anthropic  | Claude Sonnet 4.6      |        $3.00         |    $15.00     |    1M    | **상** |   **상**    | 품질·비용 균형 최상, 캐싱 효과 큼              |
| Anthropic  | Claude Haiku 4.5       |        $1.00         |     $5.00     |   200K   | **상** |   **상**    | 고속·저비용, 한국어 상급 유지                  |
| Google     | Gemini 2.5 Pro         |     $1.25~$2.50      | $10.00~$15.00 |    1M    | **상** |   **상**    | 멀티모달, 긴 문서 분석 강점, 할루시네이션 0.7% |
| Google     | Gemini 2.5 Flash       |        $0.30         |     $2.50     |    1M    | **상** |   **상**    | 속도·비용 균형, 1M 컨텍스트                    |
| Google     | Gemini 2.5 Flash-Lite  |        $0.10         |     $0.40     |    1M    |   중   |     중      | 초저가, 배치 모드 시 $0.05/MTok                |
| OpenAI     | GPT-4.1                |        $2.00         |     $8.00     |    1M    | **상** |   **상**    | 한국어 고품질, 1M 컨텍스트                     |
| OpenAI     | GPT-4.1 Mini           |        $0.40         |     $1.60     |   128K   | **상** |   **상**    | 빠른 분류·요약 작업                            |
| OpenAI     | GPT-4.1 Nano           |        $0.10         |     $0.40     |   128K   |   중   |     중      | 최저가, 단순 작업 한정                         |
| OpenAI     | o3                     |        $2.00         |     $8.00     |   200K   | **상** |   **상**    | 고급 추론 특화                                 |
| OpenAI     | o4-mini                |        $1.10         |     $4.40     |   200K   | **상** |   **상**    | 추론 모델, o3 대비 절반 가격                   |
| DeepSeek   | DeepSeek V3 (Chat)     | $0.07 (캐시) / $0.27 |     $1.10     |   128K   |   중   |     중      | 캐시 히트 90% 절감                             |
| DeepSeek   | DeepSeek V4 (최신)     | $0.03 (캐시) / $0.30 |     $0.50     |   128K   |   중   |     중      | 2026.03 출시, V3 대비 추가 절감                |
| DeepSeek   | DeepSeek R1 (Reasoner) | $0.14 (캐시) / $0.55 |     $2.19     |   128K   |   중   |     중      | 추론 특화 (수학·코딩 강점)                     |

> **DeepSeek 캐싱**: 공통 시스템 프롬프트를 재활용하는 파이프라인에서 캐시 히트율 높으면 입력 비용 최대 90% 절감 가능.  
> **o3/o4-mini 주의**: 내부 chain-of-thought로 출력 토큰 증가, 실제 비용은 표시보다 높을 수 있음.

### 1.2 확장 프로바이더 (OpenRouter 경유)

OpenRouter(openrouter.ai)를 통해 단일 API 키로 접근 가능. `ai-gateway`에 `openrouter` 프로바이더 추가 필요.

| 프로바이더 | 모델             | 입력 ($/MTok) | 출력 ($/MTok) | 컨텍스트 | 한국어 | 구조화 출력 | 비고                         |
| ---------- | ---------------- | :-----------: | :-----------: | :------: | :----: | :---------: | ---------------------------- |
| Meta       | Llama 4 Maverick |     $0.15     |     $0.60     |  **1M**  |   중   |     중      | MoE 400B, 1M 컨텍스트 강점   |
| Meta       | Llama 3.3 70B    |     $0.10     |     $0.32     |   65K    |   중   |     중      | 안정성·비용 균형             |
| Alibaba    | Qwen3.6 Plus     |     $0.33     |     $1.95     |   128K   | 중~상  |     중      | 아시아권 모델 중 한국어 최상 |
| Alibaba    | Qwen2.5-72B      |     $0.12     |     $0.39     |   32K    | 중~상  |     중      | KMMLU 벤치마크 공식 평가됨   |
| Mistral    | Mistral Large 3  |     $0.50     |     $1.50     |   262K   |   하   |     중      | 유럽어 특화, 한국어 부적합   |
| Mistral    | Mistral Small 4  |     $0.15     |     $0.60     |   262K   |   하   |     중      | 추론+멀티모달 통합           |
| xAI        | Grok-3           |     $3.00     |    $15.00     |   131K   |   중   |     중      | X 실시간 데이터 연동 가능성  |
| xAI        | Grok-3 Mini      |     $0.30     |     $0.50     |   131K   |   중   |     중      | 저비용 추론                  |

### 1.3 기타 프로바이더 (AWS Bedrock 경유)

AWS Bedrock 계정 및 SDK 통합 필요 — 현재 시스템 통합 공수 높음. 장기 로드맵 참고용.

| 프로바이더 | 모델       | 입력 ($/MTok) | 출력 ($/MTok) | 컨텍스트 | 한국어 | 비고                       |
| ---------- | ---------- | :-----------: | :-----------: | :------: | :----: | -------------------------- |
| Amazon     | Nova Pro   |     $0.80     |     $3.20     |   300K   | 중~상  | AWS Bedrock 전용, 멀티모달 |
| Amazon     | Nova Lite  |     $0.06     |     $0.24     |   300K   |   중   | 초저가 멀티모달            |
| Amazon     | Nova Micro |    $0.035     |     $0.14     |   128K   |   중   | 텍스트 전용 최저비용       |

### 1.4 한국어 성능 종합 순위

한국어 여론 분석에서 뉘앙스·감정·맥락 파악 능력 기준 순위:

```
■ 상위권 (운영 추천)
  Claude Sonnet/Opus 4.6 > GPT-4.1 > Gemini 2.5 Pro/Flash

■ 중위권 (보조 가능, 단순 분류·요약)
  Qwen3.x > Amazon Nova Pro > GPT-4.1 Mini > Gemini Flash-Lite

■ 하위권 (단순 분류만 권장)
  DeepSeek V3/V4 > Grok-3 > Llama 4 Maverick > Mistral
```

**핵심 선택 원칙**:

| 기준                  | 순위                                                |
| --------------------- | --------------------------------------------------- |
| 한국어 뉘앙스 정확도  | Claude 계열 > GPT-4.1 > Gemini (3강 외 격차 큼)     |
| 구조화 출력 신뢰성    | Claude = GPT-4.1 = Gemini Flash/Pro > 나머지        |
| 비용 효율 (캐싱 포함) | DeepSeek V4 > Gemini Flash-Lite > Haiku 4.5 > Flash |
| 긴 컨텍스트(32K+)     | Claude 전체, Gemini 전체, GPT-4.1, Llama 4 Maverick |

---

## Part 2 — 분석 모듈별 추천 매트릭스

### 2.1 모듈 그룹 분류

분석 모듈을 요구 특성에 따라 3개 그룹으로 분류한다.

| 그룹                              | 모듈                                                                                   | 핵심 요구 특성                          |
| --------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| **A — 구조 분석** (Stage 1, 병렬) | `macro-view`, `segmentation`, `sentiment-framing`, `message-impact`                    | 넓은 컨텍스트, 한국어 이해력            |
| **B — 전략 심화** (Stage 2, 순차) | `risk-map`, `opportunity`, `strategy`, `final-summary`                                 | 추론 능력, 이전 결과 통합, 긴 출력 품질 |
| **C — 고급 시뮬레이션** (Stage 4) | `approval-rating`, `frame-war`, `crisis-scenario`, `win-simulation` + 도메인 모듈 전체 | 복잡한 시나리오 추론, 창의적 생성       |

### 2.2 그룹별 티어 추천

#### 그룹 A — 구조 분석 (Stage 1)

| 티어      | 추천 모델             | 예상 비용        | 선택 이유                                   |
| --------- | --------------------- | ---------------- | ------------------------------------------- |
| **최고**  | Gemini 2.5 Pro        | ~$1.25~2.50/MTok | 1M 컨텍스트, 할루시네이션 0.7%, 한국어 상급 |
| **보통**  | Gemini 2.5 Flash      | ~$0.30/MTok      | 속도·비용 균형, 1M 컨텍스트, 한국어 상급    |
| **최소**  | Gemini 2.5 Flash-Lite | ~$0.10/MTok      | 초저가, 배치 모드 시 $0.05/MTok             |
| 대안 최고 | Claude Sonnet 4.6     | ~$3.00/MTok      | 한국어 최고 수준, JSON 신뢰성 최상          |
| 대안 최소 | GPT-4.1 Nano          | ~$0.10/MTok      | 단순 분류용, 한국어 뉘앙스 제한             |

#### 그룹 B — 전략 심화 (Stage 2)

| 티어      | 추천 모델         | 예상 비용          | 선택 이유                                   |
| --------- | ----------------- | ------------------ | ------------------------------------------- |
| **최고**  | Claude Opus 4.6   | ~$5.00/MTok        | 최고 지능, 복잡한 추론, 한국어 최상         |
| **보통**  | Claude Sonnet 4.6 | ~$3.00/MTok        | 품질·비용 균형 최적, 캐싱 효과 큼           |
| **최소**  | DeepSeek R1       | ~$0.14/MTok (캐시) | 추론 특화, 초저가 — 한국어 뉘앙스 한계 감안 |
| 대안 최고 | GPT-4.1           | ~$2.00/MTok        | 한국어 상급, 1M 컨텍스트                    |
| 대안 보통 | o4-mini           | ~$1.10/MTok        | 추론 특화, o3 대비 절반 가격                |

#### 그룹 C — 고급 시뮬레이션 (Stage 4)

| 티어      | 추천 모델         | 예상 비용   | 선택 이유                               |
| --------- | ----------------- | ----------- | --------------------------------------- |
| **최고**  | Claude Opus 4.6   | ~$5.00/MTok | 복잡한 시나리오 최적, 한국어 최상       |
| **보통**  | Claude Sonnet 4.6 | ~$3.00/MTok | 시뮬레이션 품질 충분, 비용 합리적       |
| **최소**  | Claude Haiku 4.5  | ~$1.00/MTok | 200K 컨텍스트, 한국어 상급, 고속 처리   |
| 대안 최고 | o4-mini           | ~$1.10/MTok | 추론 특화 시뮬레이션, 상대적 저비용     |
| 대안 미래 | Grok-3            | ~$3.00/MTok | X 실시간 연동 가능성 (현재 한국어 중급) |

### 2.3 전체 모듈 추천 매트릭스

> 도메인 전용 Stage 4 모듈(corporate, healthcare, sports, finance, education, pr, fandom)은 그룹 C 기준 동일 적용.

#### Stage 1 — 구조 분석 모듈

| 모듈                | 최고              | 보통             | 최소                  |
| ------------------- | ----------------- | ---------------- | --------------------- |
| `macro-view`        | Gemini 2.5 Pro    | Gemini 2.5 Flash | Gemini 2.5 Flash-Lite |
| `segmentation`      | Gemini 2.5 Pro    | Gemini 2.5 Flash | GPT-4.1 Nano          |
| `sentiment-framing` | Claude Sonnet 4.6 | Gemini 2.5 Flash | Gemini 2.5 Flash-Lite |
| `message-impact`    | Claude Sonnet 4.6 | GPT-4.1 Mini     | Gemini 2.5 Flash-Lite |

#### Stage 2 — 전략 심화 모듈

| 모듈            | 최고            | 보통              | 최소                    |
| --------------- | --------------- | ----------------- | ----------------------- |
| `risk-map`      | Claude Opus 4.6 | Claude Sonnet 4.6 | DeepSeek R1             |
| `opportunity`   | Claude Opus 4.6 | Claude Sonnet 4.6 | DeepSeek R1             |
| `strategy`      | Claude Opus 4.6 | Claude Sonnet 4.6 | DeepSeek V4 (캐시 활용) |
| `final-summary` | Claude Opus 4.6 | Claude Sonnet 4.6 | Claude Haiku 4.5        |

#### Stage 4 — 고급 시뮬레이션 모듈 (공통)

| 모듈              | 최고            | 보통              | 최소             |
| ----------------- | --------------- | ----------------- | ---------------- |
| `approval-rating` | Claude Opus 4.6 | Claude Sonnet 4.6 | Claude Haiku 4.5 |
| `frame-war`       | Claude Opus 4.6 | Claude Sonnet 4.6 | Claude Haiku 4.5 |
| `crisis-scenario` | Claude Opus 4.6 | o4-mini           | Claude Haiku 4.5 |
| `win-simulation`  | Claude Opus 4.6 | o4-mini           | Claude Haiku 4.5 |

#### Stage 4 — 팬덤 도메인 모듈

| 모듈                           | 최고              | 보통              | 최소             |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| `fan-loyalty-index`            | Claude Sonnet 4.6 | Gemini 2.5 Flash  | Claude Haiku 4.5 |
| `fandom-narrative-war`         | Claude Sonnet 4.6 | Gemini 2.5 Flash  | Claude Haiku 4.5 |
| `fandom-crisis-scenario`       | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5 |
| `release-reception-prediction` | Claude Opus 4.6   | Claude Sonnet 4.6 | Claude Haiku 4.5 |

#### Stage 4 — 기타 도메인 모듈 (corporate, healthcare, sports, finance, education, pr)

그룹 C 기준 적용:

| 티어 | 모델              |
| ---- | ----------------- |
| 최고 | Claude Opus 4.6   |
| 보통 | Claude Sonnet 4.6 |
| 최소 | Claude Haiku 4.5  |
