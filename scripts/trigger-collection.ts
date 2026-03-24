// 수집 트리거 CLI 스크립트
// 사용법: pnpm trigger <keyword> [days=7]
import 'dotenv/config';
import { triggerCollection, CollectionTriggerSchema } from '@ai-signalcraft/core';
import { createCollectionJob } from '@ai-signalcraft/core';

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('Usage: tsx scripts/trigger-collection.ts <keyword> [days=7]');
    process.exit(1);
  }

  const days = parseInt(process.argv[3] || '7');
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const params = CollectionTriggerSchema.parse({
    keyword,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  // DB에 수집 작업 레코드 생성 -- 정수 job.id 확보
  const job = await createCollectionJob({
    keyword: params.keyword,
    startDate: new Date(params.startDate),
    endDate: new Date(params.endDate),
  });

  console.log(`Collection job created: #${job.id}`);
  console.log(`  Keyword: ${keyword}`);
  console.log(`  Period: ${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}`);

  // BullMQ Flow 트리거 -- job.id (정수 DB PK)를 dbJobId로 전달
  const { flowId } = await triggerCollection(params, job.id);
  console.log(`Pipeline triggered: ${flowId} (DB job #${job.id})`);
  console.log('Worker가 실행 중이어야 합니다: pnpm worker');
}

main().catch(console.error);
