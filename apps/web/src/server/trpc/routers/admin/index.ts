import { router } from '../../init';
import { usersRouter } from './users';
import { teamsRouter } from './teams';
import { jobsRouter } from './jobs';
import { usageRouter } from './usage';
import { overviewRouter } from './overview';
import { demoRouter } from './demo';

export const adminRouter = router({
  users: usersRouter,
  teams: teamsRouter,
  jobs: jobsRouter,
  usage: usageRouter,
  overview: overviewRouter,
  demo: demoRouter,
});
