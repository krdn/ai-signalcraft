# Domain Pitfalls

**Domain:** Korean Public Opinion Analysis Pipeline (AI SignalCraft)
**Researched:** 2026-03-24

## Critical Pitfalls

치명적 실수 -- 재작성(rewrite)이나 프로젝트 중단을 유발하는 수준의 문제.

---

### Pitfall 1: 네이버 뉴스 댓글 수집 -- 공식 API 부재와 비공식 엔드포인트 의존

**What goes wrong:** 네이버 오픈 API(검색 API)는 뉴스 기사 목록만 반환하고, 댓글(comment) 데이터는 제공하지 않는다. 많은 프로젝트가 브라우저 개발자 도구에서 발견한 내부 API 엔드포인트(`apis.naver.com/commentBox/...`)를 직접 호출하여 댓글을 수집하는데, 이 엔드포인트는 공식 지원 대상이 아니라 사전 공지 없이 URL/파라미터/인증 방식이 변경된다.

**Why it happens:** 네이버는 댓글 데이터를 외부에 제공하는 공식 API를 운영하지 않는다. 개발자들이 비공식 내부 API에 의존하게 되고, 네이버 측 변경 시 수집기가 즉시 고장난다.

**Consequences:**
- 수집 파이프라인 전체가 갑자기 중단됨
- 기존 수집 로직의 전면 재작성 필요
- 댓글 없이는 여론 분석의 핵심 데이터가 누락됨

**Prevention:**
- 비공식 API 호출부를 추상화 레이어(adapter pattern)로 격리하여, 엔드포인트 변경 시 어댑터만 수정
- 수집 실패를 즉시 감지하는 헬스체크 및 알림 시스템 구축
- 수집 실패 시 fallback으로 headless browser 스크래핑 전환 가능한 구조 설계
- 네이버 뉴스 API로 기사 목록 수집 + 별도 댓글 수집 모듈로 분리

**Detection:** API 응답 status code 변화, 응답 JSON 스키마 변경, 빈 결과 반환 모니터링

**Phase mapping:** Phase 1 (데이터 수집 인프라) -- 수집기 설계 시 어댑터 패턴 필수 적용

**Confidence:** HIGH -- 네이버 오픈 API 목록에 댓글 API가 없음을 공식 문서에서 확인

---

### Pitfall 2: X(Twitter) API 비용 폭탄 -- Free/Basic 티어의 심각한 제한

**What goes wrong:** X API Free 티어는 2025년 이후 트윗 읽기(read) 기능을 완전히 제거했다. Basic 티어($200/월)도 월 15,000건 읽기로 제한되며, 이는 단일 이슈에 대한 트윗+답글을 수집하면 하루 만에 소진될 수 있는 양이다. Pro 티어는 $5,000/월, Enterprise는 $42,000+/월로 비용이 급격히 상승한다.

**Why it happens:** Elon Musk 인수 후 X는 API 접근을 공격적으로 유료화했다. 많은 프로젝트가 "API 있으니까 되겠지"라고 가정하고 시작한 뒤, 실제 비용을 확인하고 좌절한다.

**Consequences:**
- 월 $200으로 시작해도 데이터 부족으로 분석 품질 저하
- 실질적으로 유의미한 분석에는 Pro($5,000/월) 이상 필요
- 예산 초과로 X 데이터 수집 자체를 포기하는 경우 다수

**Prevention:**
- 프로젝트 초기에 X API 티어별 월간 비용 시뮬레이션 실행
- Basic 티어에서 시작하되, 쿼리를 극도로 최적화 (키워드 정제, 날짜 범위 축소)
- X 데이터를 "필수"가 아닌 "보조" 소스로 포지셔닝 -- 네이버/유튜브/커뮤니티를 주력으로
- 2026년 2월 출시된 Pay-Per-Use 모델 (건당 ~$0.01) 활용 검토 (현재 클로즈드 베타)

**Detection:** 월간 API 사용량 대시보드, 일별 quota 소진율 추적

**Phase mapping:** Phase 0 (기획) -- API 비용 시뮬레이션으로 Go/No-Go 결정 필요

**Confidence:** HIGH -- X 공식 가격 정책 및 다수 개발자 커뮤니티 보고 확인

---

### Pitfall 3: LLM 분석의 환각(Hallucination)과 정치적 편향

**What goes wrong:** LLM에 한국 여론 데이터를 넣고 "분석해줘"라고 하면, 모델이 (1) 존재하지 않는 트렌드를 만들어내거나(환각), (2) 서구 정치 프레임을 한국 맥락에 잘못 적용하거나(편향), (3) 동일한 프롬프트에 다른 결과를 반환한다(비결정성). 연구에 따르면 LLM은 지식 컷오프 이후 데이터에 대해 57.33%의 환각률을 보이며, 한국 정치 맥락에서 ChatGPT 기반 접근법은 서구 학습 데이터의 양극화 패턴을 과대 적용하는 경향이 있다.

**Why it happens:**
- LLM 학습 데이터에 한국 정치/여론 맥락이 상대적으로 부족
- 한국의 정당 충성도와 정치 역학은 서구와 구조적으로 다름
- 모델의 stochastic inference 특성상 동일 입력에 다른 출력 가능

**Consequences:**
- "AI 분석"이라고 했지만 실제로는 허위 인사이트 제공
- 잘못된 분석에 기반한 전략 수립 시 치명적 의사결정 오류
- 분석 결과의 재현 불가능으로 신뢰도 상실

**Prevention:**
- 분석 결과에 반드시 원본 데이터 인용(citation) 포함 -- "근거 없는 주장" 차단
- 동일 데이터에 대해 3회 이상 분석 실행 후 결과 교차 검증 (majority voting)
- temperature=0 설정으로 비결정성 최소화
- 한국 정치 맥락을 명시하는 시스템 프롬프트 설계 (정당 구조, 세대 갈등, 지역 갈등 등)
- 정량적 데이터(댓글 수, 좋아요/싫어요 비율)는 LLM이 아닌 코드로 직접 집계
- LLM은 "구조화된 텍스트 분류"와 "요약"에만 활용, 수치 추정은 통계 모델 사용

**Detection:** 분석 결과에서 원본 데이터와 매칭되지 않는 주장 자동 검출, A/B 비교 테스트

**Phase mapping:** Phase 2 (AI 분석 모듈) -- 프롬프트 엔지니어링과 검증 파이프라인 설계 시 핵심

**Confidence:** HIGH -- ICLR 2025 논문, PMC 연구, 한국 여론 분석 특화 연구 다수 확인

---

### Pitfall 4: 한국어 NLP -- 신조어/슬랭/자모 분리 처리 실패

**What goes wrong:** 한국 온라인 커뮤니티(DC갤러리, 에펨코리아)의 댓글에는 표준 한국어와 완전히 다른 언어 패턴이 존재한다:
- 자모 분리: "ㅋㅋㅋㅋ", "ㅎㅎ", "ㄹㅇ", "ㄱㅇㄷ"
- 초성 축약: "ㅇㅈ" (인정), "ㄴㄴ" (노노)
- 신조어/밈: 정치 관련 신조어가 주 단위로 생성/소멸
- 의도적 표기 변형: "문재앙", "윤거열" 등 인물명 변형
- 반어적 표현: "역시 대통령님 잘하신다" (실제로는 비꼬는 표현)

기존 형태소 분석기(Mecab, KoNLPy)는 이런 비표준 입력에서 대부분 실패한다.

**Why it happens:** 한국어의 교착어(agglutinative) 특성상 형태소 분석이 원래 복잡한데, 인터넷 언어는 이 복잡성을 극대화한다. 형태소 분석기의 사전에 없는 단어가 댓글의 30-50%를 차지할 수 있다.

**Consequences:**
- 감성 분석 정확도 급락 (반어/풍자를 긍정으로 오분류)
- 키워드 추출에서 핵심 담론 누락
- 인물명 변형을 감지하지 못해 관련 댓글 수집 누락

**Prevention:**
- LLM 기반 감성 분석 활용 -- 전통 NLP보다 맥락 이해 우수 (단, Pitfall 3의 검증 필수)
- 인물별 별명/변형 사전(alias dictionary) 구축 및 주기적 업데이트
- 자모 분리(ㅋㅋㅋ → 웃음/긍정) 전처리 정규화 모듈 구축 (soynlp 활용)
- 반어/풍자 감지는 댓글의 좋아요/싫어요 비율과 문맥을 함께 고려

**Detection:** 형태소 분석 미등록어(OOV) 비율 모니터링, 분석 결과 수동 샘플링 검증

**Phase mapping:** Phase 1-2 -- 데이터 전처리 파이프라인과 AI 분석 모듈 양쪽에서 대응

**Confidence:** HIGH -- 한국어 NLP 커뮤니티와 학술 연구에서 지속적으로 보고되는 문제

---

### Pitfall 5: 웹 스크래핑 법적 리스크 -- 한국 법률의 회색지대

**What goes wrong:** 한국에서 웹 크롤링은 명확한 합법/불법 구분이 없는 회색지대다. 대법원 2022도1533 판결에서 크롤링의 형사법적 문제를 다뤘고, 부정경쟁방지법 개정으로 "데이터베이스의 상당 부분을 체계적으로 복제"하는 행위는 위법으로 판단될 수 있다. 한국 저작권법에는 TDM(텍스트-데이터마이닝) 면책 조항이 아직 없다.

**Why it happens:**
- robots.txt 위반 자체는 법적 구속력이 없지만(2025년 지프 데이비스 판결), 이용약관 위반은 민사 책임 가능
- 댓글/게시글 수집 시 닉네임 등 개인정보 포함 가능 -- 개인정보보호법 적용 영역
- 2025년 문화체육관광부 AI-저작권 제도개선 협의체 출범했으나 입법 성과 미정

**Consequences:**
- 법적 소송 리스크 (특히 네이버, DC갤러리 등 대형 플랫폼)
- 개인정보보호법 위반 시 형사처벌 가능
- 프로젝트 전체 중단 가능성

**Prevention:**
- API 우선 원칙 철저 준수 (YouTube Data API, 네이버 검색 API 등 공식 경로 최대 활용)
- 스크래핑 시 robots.txt 준수 + 이용약관 검토 문서화
- 수집 데이터에서 닉네임/프로필 사진 등 개인정보 즉시 익명화/해시 처리
- 수집 빈도와 부하를 최소화 (rate limiting, 서버 부담 미발생 수준)
- 법률 자문 받기 -- 프로젝트 규모가 상업적 수준이라면 필수
- 수집 목적(여론 분석/연구)과 비영리성을 명확히 문서화

**Detection:** robots.txt 변경 자동 감시, 이용약관 변경 알림 설정

**Phase mapping:** Phase 0 (기획) -- 법률 검토 완료 후 수집 대상 확정

**Confidence:** MEDIUM -- 판례와 법률 조문 확인했으나 AI 시대 크롤링 관련 법률이 빠르게 변화 중

---

## Moderate Pitfalls

심각하지만 조기 대응 시 관리 가능한 문제.

---

### Pitfall 6: YouTube Data API 일일 Quota 소진

**What goes wrong:** YouTube Data API 기본 할당량은 일일 10,000 units이다. 검색(search.list)은 요청당 100 units을 소비하므로, 하루에 100번의 검색만 가능하다. 댓글 목록(commentThreads.list)은 1 unit이지만, 인기 영상의 댓글이 수천~수만 건이면 페이지네이션으로 수백 회 호출이 필요하다. 한 번의 분석 트리거로 여러 인물의 관련 영상을 검색하면 quota를 순식간에 소진한다.

**What goes wrong additionally:** Quota 초과 시 다음 날 자정(Pacific Time, 한국시간 오후 5시)까지 모든 API 호출이 차단된다.

**Prevention:**
- search.list 대신 videos.list(1 unit)와 채널 기반 수집 병행
- 검색 결과를 로컬 캐싱하여 중복 검색 방지
- 댓글은 배치로 수집하고 일일 quota 예산 시스템 구축
- Quota 증가 신청 (무료, 단 API ToS 준수 감사 필요)
- 수집 스케줄링: 한국시간 오후 5시에 quota 리셋되므로 이에 맞춘 수집 타이밍

**Detection:** API 응답의 quota 잔여량 모니터링, 일일 사용량 로깅

**Phase mapping:** Phase 1 (데이터 수집) -- 수집기 설계 시 quota 예산 관리 로직 포함

**Confidence:** HIGH -- YouTube Data API 공식 문서에서 quota 체계 확인

---

### Pitfall 7: AI API 토큰 비용 폭증 -- 대량 텍스트 분석의 함정

**What goes wrong:** 공인 한 명에 대한 여론 분석 시, 네이버 뉴스 기사 50건 + 댓글 5,000건 + 유튜브 댓글 3,000건 + 커뮤니티 게시글 500건을 분석하면 수백만 토큰이 필요하다. Claude Sonnet 4.5 기준 입력 $3/MTok, 출력 $15/MTok이며, 분석 1회에 $5~20이 들 수 있다. 한 달에 10명의 공인을 주 2회 분석하면 월 $400~1,600+.

**Why it happens:** 댓글 텍스트는 짧지만 건수가 많아 총 토큰이 폭발적으로 증가한다. 각 댓글을 개별 분석하면 API 호출 수도 급증한다.

**Prevention:**
- 댓글을 배치(100~200건 단위)로 묶어 한 번에 분석 -- API 호출 수 절감
- Prompt Caching 활용 (동일 시스템 프롬프트 반복 시 90% 절감)
- Batch API 활용 (비동기 처리, 50% 할인)
- 정량 분석(좋아요 수, 감성 키워드 빈도)은 코드로 처리, LLM은 정성 분석에만 투입
- 모델 티어링: 단순 분류는 Haiku($1/MTok), 심층 분석은 Sonnet($3/MTok) 사용
- 200K 토큰 초과 시 장문 입력 할증(input $6/MTok) 적용되므로 청크 분할 필수

**Detection:** 분석 건당 비용 로깅, 월간 비용 추이 대시보드

**Phase mapping:** Phase 2 (AI 분석) -- 비용 최적화 전략을 아키텍처 수준에서 설계

**Confidence:** HIGH -- Anthropic/OpenAI 공식 가격 정책 기준

---

### Pitfall 8: 커뮤니티 사이트 스크래핑 불안정성 -- Cloudflare 및 구조 변경

**What goes wrong:** DC갤러리, 에펨코리아, 클리앙 등 한국 커뮤니티 사이트는 (1) Cloudflare 또는 자체 봇 차단 시스템을 운영하며, (2) HTML 구조를 예고 없이 변경하고, (3) IP 기반 rate limiting을 적극 적용한다. 2025년 7월 Cloudflare는 AI 크롤러 기본 차단을 도입했으며, 한국 사이트들도 이를 적극 활용 중이다.

**Why it happens:** 커뮤니티 사이트들은 서버 부하와 데이터 무단 수집에 민감하다. API를 제공하지 않으므로 스크래핑이 유일한 수단이지만, 사이트 측에서 지속적으로 차단 수위를 높인다.

**Prevention:**
- Headless browser(Playwright/Puppeteer) 사용으로 JavaScript 렌더링 대응
- 요청 간격을 인간 수준으로 조절 (3~10초 랜덤 딜레이)
- User-Agent 로테이션 및 세션 관리
- HTML 파싱 로직을 CSS selector 기반으로 추상화, 변경 감지 시 알림
- 수집 모듈별 독립 배포 -- 한 사이트 차단이 전체 파이프라인을 멈추지 않도록
- 커뮤니티 데이터를 "있으면 좋은 보조 소스"로 분류, 핵심 분석은 API 기반 소스에 의존

**Detection:** 스크래핑 성공률 모니터링 (정상 응답 vs 차단 응답 비율)

**Phase mapping:** Phase 1 (데이터 수집) -- 각 사이트별 수집기를 독립 모듈로 설계

**Confidence:** MEDIUM -- Cloudflare 공식 발표 확인, 개별 사이트의 차단 수준은 가변적

---

### Pitfall 9: 데이터 중복 및 품질 -- 동일 콘텐츠의 다중 수집

**What goes wrong:** 네이버 뉴스의 경우 동일 기사가 여러 언론사에 중복 게재(통신사 기사 배포)되고, 유튜브에서는 같은 영상이 여러 채널에 재업로드되며, 커뮤니티에서는 동일 글이 크로스포스팅된다. 이런 중복 데이터를 제거하지 않으면 특정 의견이 과대 대표되어 여론 분석이 왜곡된다.

**Why it happens:** 한국 미디어 생태계의 구조적 특성 -- 통신사(연합뉴스, 뉴시스) 기사를 수십 개 언론사가 그대로 전재하는 관행이 있고, 인기 콘텐츠는 커뮤니티 간 빠르게 퍼진다.

**Prevention:**
- 뉴스: 제목+본문 유사도 기반 중복 제거 (MinHash/SimHash)
- 댓글: (사용자ID or 해시) + 타임스탬프 + 텍스트 해시 복합키로 dedup
- 수집 시점에 URL/ID 기반 1차 중복 체크, 저장 후 텍스트 유사도 기반 2차 체크
- 크로스 플랫폼 동일 콘텐츠 감지 (동일 텍스트가 DC갤러리 + 에펨코리아에 존재)

**Detection:** 중복률 메트릭 대시보드, 비정상적으로 동일한 텍스트 패턴 알림

**Phase mapping:** Phase 1 (데이터 수집/저장) -- 수집 파이프라인에 dedup 모듈 내장

**Confidence:** HIGH -- 한국 미디어 생태계의 잘 알려진 특성

---

### Pitfall 10: 집단별 분석(연령/성별/정치성향)의 근거 부재

**What goes wrong:** PROJECT.md 요구사항에 "연령/성별/정치성향/플랫폼별 집단 분석"이 있으나, 네이버 댓글/유튜브 댓글/커뮤니티 게시글에서 작성자의 연령, 성별, 정치성향을 직접 알 수 있는 메타데이터는 존재하지 않는다. LLM에게 "이 댓글 작성자의 나이를 추정해줘"라고 하면 환각에 의존한 추측만 반환된다.

**Why it happens:** 한국 플랫폼은 실명제 폐지 이후 익명/닉네임 기반으로 운영되며, 인구통계 정보를 공개하지 않는다.

**Prevention:**
- 플랫폼별 분석으로 대체: DC갤러리 vs 클리앙 vs 네이버 뉴스 댓글의 논조 차이 비교 (플랫폼 특성이 사용자 성향의 프록시)
- 직접적 인구통계 추정 대신 "담론 클러스터" 분석으로 전환 -- 비슷한 주장을 하는 그룹을 식별
- 정치성향은 사용 키워드/프레임으로 간접 추정 (단, 한계를 명시)
- 이 기능의 한계를 대시보드에 명시적으로 표시 ("추정치이며 실제 인구통계가 아님")

**Detection:** 분석 보고서에 근거 데이터 출처 필수 명시, 추정 vs 사실 구분 표시

**Phase mapping:** Phase 2-3 (분석 모듈 + 대시보드) -- 요구사항 재정의 필요

**Confidence:** HIGH -- 한국 플랫폼 구조상 명백한 제약

---

## Minor Pitfalls

인지하고 있으면 쉽게 회피 가능한 문제.

---

### Pitfall 11: 수동 트리거 실행의 UX 함정

**What goes wrong:** "수동 트리거"라고 해도, 분석 실행에 30분~1시간이 걸릴 수 있다 (수집 + 전처리 + AI 분석). 사용자가 트리거 후 결과를 기다리는 동안 진행 상황을 알 수 없으면 시스템이 멈춘 것으로 오해한다.

**Prevention:**
- 비동기 작업 큐(job queue) 도입, 진행률 표시(단계별 상태)
- 분석 완료 시 알림 (웹소켓 또는 이메일/슬랙)
- 예상 소요 시간 표시

**Phase mapping:** Phase 3 (대시보드) -- 작업 상태 표시 UI 설계

---

### Pitfall 12: AI 지지율 추정 모델의 과신

**What goes wrong:** 온라인 여론 데이터로 추정한 "AI 지지율"을 실제 여론조사 결과처럼 신뢰하면 위험하다. 온라인 댓글 작성자는 전체 유권자의 극소수이며, 특정 성향으로 편향되어 있다.

**Prevention:**
- "AI 추정 지지율"이 아닌 "온라인 여론 지수(sentiment index)"로 명칭 변경
- 실제 여론조사 데이터와의 상관관계 분석을 통해 보정 계수 개발
- 대시보드에 "이 수치는 온라인 데이터 기반 추정이며 여론조사와 다를 수 있음" 경고 표시

**Phase mapping:** Phase 2 (분석 모듈) -- 모델 설계 시 한계 명시

---

### Pitfall 13: 다중 AI 모델 전환의 프롬프트 호환성

**What goes wrong:** Claude와 GPT는 동일 프롬프트에 다른 품질/형식의 응답을 반환한다. 모델 전환 시 분석 결과의 일관성이 깨지고, 시계열 비교가 불가능해진다.

**Prevention:**
- 모델별 프롬프트 버전 관리 (prompt registry)
- 출력 형식을 JSON Schema로 강제하여 구조적 일관성 확보
- 모델 변경 시 동일 데이터에 대한 비교 테스트(evaluation set) 실행
- 분석 결과에 사용된 모델/프롬프트 버전 메타데이터 저장

**Phase mapping:** Phase 2 (AI 분석) -- 프롬프트 관리 시스템 설계

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 0: 기획/설계 | X API 비용 과소 추정 (#2), 법적 리스크 무시 (#5) | API 비용 시뮬레이션, 법률 검토 선행 |
| Phase 1: 데이터 수집 | 네이버 비공식 API 의존 (#1), 커뮤니티 스크래핑 불안정 (#8), 데이터 중복 (#9), YouTube quota (#6) | 어댑터 패턴, 독립 모듈, dedup 파이프라인 |
| Phase 2: AI 분석 | LLM 환각/편향 (#3), 한국어 NLP (#4), 토큰 비용 (#7), 집단 분석 근거 부재 (#10) | 검증 파이프라인, 비용 최적화, 요구사항 재정의 |
| Phase 3: 대시보드/UX | 수동 트리거 UX (#11), 지지율 과신 (#12), 모델 일관성 (#13) | 비동기 큐 + 진행률, 한계 명시, 프롬프트 관리 |

## Sources

### Legal / Regulatory
- [대법원 2022도1533 판결 - 웹 크롤링 형사법적 문제](https://file.scourt.go.kr/dcboard/1727143941701_111221.pdf)
- [데이터 크롤링의 한국법상 허용기준](https://www.mondaq.com/copyright/1266554)
- [무단 크롤링의 법적 함정 - 법률신문](https://www.lawtimes.co.kr/opinion/202909)
- [불법적인 크롤링 대응방안](https://www.nepla.ai/wiki/it-%EC%A0%95%EB%B3%B4-%EB%B0%A9%EC%86%A1%ED%86%B5%EC%8B%A0/%EC%9D%B8%ED%84%B0%EB%84%B7-%EB%B0%A9%EC%86%A1-%ED%86%B5%EC%8B%A0/%EB%B6%88%EB%B2%95%EC%A0%81%EC%9D%B8-%ED%81%AC%EB%A1%A4%EB%A7%81-%EA%B7%B8-%EB%8C%80%EC%9D%91%EB%B0%A9%EC%95%88%EC%9D%80-w5dnz3d4q8e6)

### API Pricing & Limits
- [X API Pricing Tiers 2025](https://twitterapi.io/blog/twitter-api-pricing-2025)
- [X API Pricing 2026 All Tiers](https://zernio.com/blog/twitter-api-pricing)
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube API Quota System](https://docs.expertflow.com/cx/4.9/understanding-the-youtube-data-api-v3-quota-system)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [LLM API Pricing Comparison 2026](https://claude5.ai/news/llm-api-pricing-comparison-2025-complete-guide)

### LLM Analysis & Korean NLP
- [LLM Sentiment Analysis Uncertainty - Frontiers](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1609097/full)
- [LLMs for Public Opinion Analysis](https://www.cogitatiopress.com/mediaandcommunication/article/viewFile/9677/4381)
- [KoNLPy: Korean NLP in Python](https://konlpy.org/)
- [soynlp - 한국어 전처리](https://github.com/lovit/soynlp)

### Scraping & Bot Detection
- [Cloudflare AI Crawler Default Blocking (2025)](https://www.cloudflare.com/press/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large/)
- [네이버 AI 봇 크롤링 차단](https://www.etnews.com/20250716000347)
- [네이버 오픈 API 목록](https://naver.github.io/naver-openapi-guide/apilist.html)
