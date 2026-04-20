-- Layer A에서 쓰는 쿼리들이 인덱스를 타는지 확인
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM raw_items WHERE fetched_from_run = '00000000-0000-0000-0000-000000000000';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM collection_runs
WHERE run_id = '00000000-0000-0000-0000-000000000000' AND source = 'naver-news'
ORDER BY time DESC LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT run_id, source, time, subscription_id FROM collection_runs
WHERE status = 'running' AND time < NOW() - INTERVAL '10 minutes'
ORDER BY time DESC LIMIT 50;
