import { getWorkerStatus } from '@ai-signalcraft/core';
import { router, systemAdminProcedure } from '../../init';
import { usersRouter } from './users';
import { teamsRouter } from './teams';
import { jobsRouter } from './jobs';
import { usageRouter } from './usage';
import { overviewRouter } from './overview';
import { demoRouter } from './demo';
import { adminPartnersRouter } from './partners';
import { adminShowcaseRouter } from './showcase';
import { sourcesRouter } from './sources';
import { adminReleasesRouter } from './releases';
import { adminFeatureRequestsRouter } from './feature-requests';
import { adminPresetsRouter } from './presets';
import { workerManagementRouter } from './worker-management';

export const adminRouter = router({
  users: usersRouter,
  teams: teamsRouter,
  jobs: jobsRouter,
  usage: usageRouter,
  overview: overviewRouter,
  demo: demoRouter,
  partners: adminPartnersRouter,
  showcase: adminShowcaseRouter,
  sources: sourcesRouter,
  releases: adminReleasesRouter,
  featureRequests: adminFeatureRequestsRouter,
  presets: adminPresetsRouter,
  workerMgmt: workerManagementRouter,
  workerStatus: systemAdminProcedure.query(async () => {
    return await getWorkerStatus();
  }),
});
