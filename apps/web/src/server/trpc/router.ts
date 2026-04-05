import { router } from './init';
import { analysisRouter } from './routers/analysis';
import { pipelineRouter } from './routers/pipeline';
import { historyRouter } from './routers/history';
import { teamRouter } from './routers/team';
import { reportRouter } from './routers/report';
import { collectedDataRouter } from './routers/collected-data';
import { settingsRouter } from './routers/settings';
import { adminRouter } from './routers/admin';
import { demoAuthRouter } from './routers/demo-auth';

export const appRouter = router({
  analysis: analysisRouter,
  pipeline: pipelineRouter,
  history: historyRouter,
  team: teamRouter,
  report: reportRouter,
  collectedData: collectedDataRouter,
  settings: settingsRouter,
  admin: adminRouter,
  demoAuth: demoAuthRouter,
});
export type AppRouter = typeof appRouter;
