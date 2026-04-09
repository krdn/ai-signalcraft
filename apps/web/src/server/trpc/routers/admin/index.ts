import { router } from '../../init';
import { usersRouter } from './users';
import { teamsRouter } from './teams';
import { jobsRouter } from './jobs';
import { usageRouter } from './usage';
import { overviewRouter } from './overview';
import { demoRouter } from './demo';
import { adminPartnersRouter } from './partners';
import { adminShowcaseRouter } from './showcase';
import { sourcesRouter } from './sources';

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
});
