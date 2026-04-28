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
import { partnerRouter } from './routers/partner';
import { salesRouter } from './routers/sales';
import { showcaseRouter } from './routers/showcase';
import { exploreRouter } from './routers/explore';
import { releaseRouter } from './routers/release';
import { featureRequestRouter } from './routers/feature-request';
import { presetsRouter } from './routers/presets';
import { searchRouter } from './routers/search';
import { ontologyRouter } from './routers/ontology';
import { llmInsightsRouter } from './routers/llm-insights';
import { seriesRouter } from './routers/series';
import { subscriptionsRouter } from './routers/subscriptions';
import { manipulationRouter } from './routers/manipulation';

export const appRouter = router({
  analysis: analysisRouter,
  subscriptions: subscriptionsRouter,
  manipulation: manipulationRouter,
  pipeline: pipelineRouter,
  history: historyRouter,
  team: teamRouter,
  report: reportRouter,
  collectedData: collectedDataRouter,
  settings: settingsRouter,
  admin: adminRouter,
  demoAuth: demoAuthRouter,
  partner: partnerRouter,
  sales: salesRouter,
  showcase: showcaseRouter,
  explore: exploreRouter,
  release: releaseRouter,
  featureRequest: featureRequestRouter,
  presets: presetsRouter,
  search: searchRouter,
  ontology: ontologyRouter,
  llmInsights: llmInsightsRouter,
  series: seriesRouter,
});
export type AppRouter = typeof appRouter;
