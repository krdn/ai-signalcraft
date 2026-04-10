-- 임베딩 HNSW 인덱스 (코사인 거리, 소규모 데이터에 최적화)
-- 데이터가 충분히 쌓인 후 실행 권장 (초기에는 NULL이 많아 인덱스 효율 낮음)

CREATE INDEX IF NOT EXISTS articles_embedding_hnsw_idx
  ON articles
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS comments_embedding_hnsw_idx
  ON comments
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
