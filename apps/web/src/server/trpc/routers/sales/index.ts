import { router } from '../../init';
import { salesDashboardRouter } from './dashboard';
import { salesLeadsRouter } from './leads';
import { shareLinksRouter } from './share-links';
import { partnerToolsRouter } from './partner-tools';
import { salesEmailsRouter } from './emails';

export const salesRouter = router({
  dashboard: salesDashboardRouter,
  leads: salesLeadsRouter,
  shareLinks: shareLinksRouter,
  partnerTools: partnerToolsRouter,
  emails: salesEmailsRouter,
});
