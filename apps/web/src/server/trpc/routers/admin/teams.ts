import { z } from 'zod';
import { eq, sql, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { users, teams, teamMembers, collectionJobs } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const teamsRouter = router({
  list: systemAdminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
        memberCount: sql<number>`(SELECT COUNT(*) FROM team_members WHERE team_id = ${teams.id})`,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt));

    return result;
  }),

  getDetail: systemAdminProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1);

      if (!team) throw new TRPCError({ code: 'NOT_FOUND' });

      const members = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .innerJoin(users, eq(users.id, teamMembers.userId))
        .where(eq(teamMembers.teamId, input.teamId));

      const [jobStats] = await ctx.db
        .select({
          totalJobs: count(),
          completedJobs: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'completed')`,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.teamId, input.teamId));

      return { team, members, jobStats };
    }),
});
