-- pgvector HNSW 인덱스 마이그레이션
-- 실행 방법: psql $DATABASE_URL -f packages/core/sql/001_pgvector_hnsw_indexes.sql
--
-- 기존 상태: articles/comments.embedding (vector(384)) 컬럼 있음, 인덱스 없음
-- 적용 시: RAG 검색(pgvector <=> 연산자)이 5~10배 빨라짐
--
-- HNSW 파라미터:
--   m = 16        — 그래프 차수 (기본값, 정확도/속도 균형)
--   ef_construction = 64  — 빌드 시 탐색 폭 (기본값)
-- 검색 시점에는 SET hnsw.ef_search = 40; (기본 40, 높이면 정확도↑)
--
-- 주의:
--   - HNSW 인덱스 빌드는 처음엔 수십 초~수 분 소요 (기존 데이터 양에 따라)
--   - CONCURRENTLY 옵션으로 lock 없이 빌드 (트랜잭션 외부에서 실행 필요)
--   - 운영 중 SELECT는 차단하지 않음, INSERT/UPDATE는 약간의 지연 발생

-- 확장 확인 (이미 있다면 no-op)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. articles.embedding 코사인 거리 HNSW 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_embedding_hnsw_cosine
  ON articles
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. comments.embedding 코사인 거리 HNSW 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_embedding_hnsw_cosine
  ON comments
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 인덱스 상태 확인 쿼리 (참고용)
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname LIKE '%embedding_hnsw%';
-- SELECT pg_size_pretty(pg_relation_size('articles_embedding_hnsw_cosine'));
