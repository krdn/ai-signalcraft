// 분석 재트리거 스크립트 — BullMQ API를 통해 올바른 형식으로 작업 추가
import { triggerAnalysis } from '../src/queue/flows';

async function main() {
  const dbJobId = parseInt(process.argv[2] || '207');
  const keyword = process.argv[3] || '한동훈';

  console.log(`분석 재트리거: jobId=${dbJobId}, keyword=${keyword}`);

  await triggerAnalysis(dbJobId, keyword);
  console.log('작업 추가 완료');

  setTimeout(() => process.exit(0), 3000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
