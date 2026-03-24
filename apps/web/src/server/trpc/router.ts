import { router } from './init';
import { analysisRouter } from './routers/analysis';
import { pipelineRouter } from './routers/pipeline';
import { historyRouter } from './routers/history';
import { teamRouter } from './routers/team';
import { reportRouter } from './routers/report';

export const appRouter = router({
  analysis: analysisRouter,
  pipeline: pipelineRouter,
  history: historyRouter,
  team: teamRouter,
  report: reportRouter,
});
export type AppRouter = typeof appRouter;
