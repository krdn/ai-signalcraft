# AI SignalCraft — Technology Stack Reference

> CLAUDE.md에서 분리된 상세 기술 스택 문서. 의사결정 근거와 대안 비교 포함.

## Core Stack

| Category      | Technology                                        | Version      | Purpose                      |
| ------------- | ------------------------------------------------- | ------------ | ---------------------------- |
| Framework     | Next.js (App Router)                              | 15.x         | 풀스택 (대시보드 + API)      |
| Language      | TypeScript                                        | 5.x          | 타입 안전성                  |
| UI            | React                                             | 19.x         | Server Components + Suspense |
| Database      | PostgreSQL                                        | 16.x         | 메인 DB (JSONB + 관계형)     |
| ORM           | Drizzle ORM                                       | 0.40.x       | SQL-like 쿼리 빌더           |
| Cache/Queue   | Redis                                             | 7.x          | BullMQ 백엔드 + 캐싱         |
| AI            | Vercel AI SDK                                     | v6           | 다중 AI 프로바이더 통합      |
| AI Providers  | @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google | latest       | Claude, GPT, Gemini          |
| Schema        | Zod                                               | 3.x          | AI 출력 + API 입력 검증      |
| Queue         | BullMQ                                            | 5.x          | Flow 기반 파이프라인         |
| Scraping      | Playwright + Cheerio                              | 1.50.x / 1.x | 한국 사이트 스크래핑         |
| YouTube       | googleapis                                        | 144.x        | YouTube Data API v3          |
| UI Components | shadcn/ui + Tailwind CSS                          | 4.x          | 대시보드 UI                  |
| Charts        | Recharts                                          | 2.x          | 차트/그래프 (shadcn 통합)    |
| State         | TanStack Query                                    | 5.x          | 서버 상태 관리               |
| API           | tRPC                                              | 11.x         | 타입 안전 API                |
| Auth          | NextAuth.js (Auth.js)                             | 5.x          | 소규모 팀 인증               |
| Container     | Docker + Compose                                  | 27.x / 2.x   | 운영 서버 배포               |
| Test          | Vitest                                            | 3.x          | 테스트 프레임워크            |
| Lint          | ESLint 9 + Prettier 3                             | latest       | 코드 품질                    |

## Alternatives Considered

| Category | Recommended           | Alternative                | Why Not                                                          |
| -------- | --------------------- | -------------------------- | ---------------------------------------------------------------- |
| ORM      | Drizzle ORM           | Prisma                     | 무겁고 느림. 복잡한 분석 쿼리에서 SQL-like 빌더가 더 표현력 있음 |
| Chart    | Recharts (via shadcn) | Nivo, Tremor               | shadcn 테마 통합 불가 / 메타 라이브러리 불필요                   |
| API      | tRPC                  | Server Actions only / REST | 캐싱/갱신/TanStack Query 통합 필요                               |
| Scraper  | Playwright            | Puppeteer                  | 안정성, 한국 로케일, auto-wait                                   |
| Queue    | BullMQ                | Agenda.js                  | Flow 기능, Redis 인프라 활용                                     |
| AI       | Vercel AI SDK v6      | LangChain.js               | 과도한 추상화, 단일 프롬프트 중심이므로 AI SDK 적합              |
| DB       | PostgreSQL            | MongoDB                    | 분석 결과는 관계형 적합, JSONB로 비정형도 처리                   |
| Auth     | NextAuth.js 5         | Lucia Auth                 | 생태계 표준, 소규모 팀에 충분                                    |

## Architecture Decision

TypeScript 모노리포 선택 (vs Python+TS 폴리글랏).

- 단일 언어 통일, 타입 공유, 배포 단순
- Korean NLP는 @xenova/transformers로 Node.js 내 처리

## Key Version Constraints

| Package    | Min Version | Reason                      |
| ---------- | ----------- | --------------------------- |
| Node.js    | 24.x        | 사용자 환경                 |
| pnpm       | 9.x         | 패키지 매니저               |
| PostgreSQL | 16.x        | Identity column, JSONB 개선 |
| Redis      | 7.x         | BullMQ 5.x 호환             |

## Sources

- [AI SDK v6](https://ai-sdk.dev/docs/introduction)
- [Drizzle ORM](https://orm.drizzle.team/docs/get-started-postgresql)
- [BullMQ](https://docs.bullmq.io/)
- [shadcn/ui Charts](https://ui.shadcn.com/charts/area)
- [tRPC Next.js](https://trpc.io/docs/client/nextjs)
- [YouTube Data API v3](https://developers.google.com/youtube/v3/docs/comments/list)
- [Playwright](https://playwright.dev/)
