import { router } from './init';
import { analysisRouter } from './routers/analysis';
import { pipelineRouter } from './routers/pipeline';
import { historyRouter } from './routers/history';

export const appRouter = router({
  analysis: analysisRouter,
  pipeline: pipelineRouter,
  history: historyRouter,
});
export type AppRouter = typeof appRouter;
