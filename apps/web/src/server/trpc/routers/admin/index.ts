import { router } from '../../init';
import { usersRouter } from './users';
import { teamsRouter } from './teams';
import { jobsRouter } from './jobs';
import { usageRouter } from './usage';
import { overviewRouter } from './overview';
import { demoRouter } from './demo';
import { adminPartnersRouter } from './partners';

export const adminRouter = router({
  users: usersRouter,
  teams: teamsRouter,
  jobs: jobsRouter,
  usage: usageRouter,
  overview: overviewRouter,
  demo: demoRouter,
  partners: adminPartnersRouter,
});
