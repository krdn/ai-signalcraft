import { z } from 'zod';
import {
  getWorkerStatus,
  getQueueStatus,
  pauseQueue,
  resumeQueue,
  getStalledJobs,
  removeStalledJobs,
  getFailedJobs,
  retryFailedJob,
  removeFailedJobs,
  removeJob,
  checkOrphanedJobs,
  cleanupBeforeNewPipeline,
} from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

const queueNameSchema = z.enum(['collectors', 'pipeline', 'analysis']);

const jobRefSchema = z.object({
  bullmqId: z.string(),
  queue: queueNameSchema,
});

export const workerManagementRouter = router({
  getQueueOverview: systemAdminProcedure.query(async () => {
    const [workerHealth, queueStatus, stalledJobs, failedJobs] = await Promise.all([
      getWorkerStatus(),
      getQueueStatus(),
      getStalledJobs(),
      getFailedJobs(),
    ]);
    return { workerHealth, queueStatus, stalledJobs, failedJobs };
  }),

  pauseQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await pauseQueue(input.queueName);
      return { paused: true, queue: input.queueName };
    }),

  resumeQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await resumeQueue(input.queueName);
      return { resumed: true, queue: input.queueName };
    }),

  removeStalledJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeStalledJobs(input.jobs);
      return { removed };
    }),

  retryFailedJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const retried = await retryFailedJob(input.bullmqId, input.queue);
    return { retried };
  }),

  removeFailedJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeFailedJobs(input.jobs);
      return { removed };
    }),

  removeJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const removed = await removeJob(input.bullmqId, input.queue);
    return { removed };
  }),

  checkOrphanedJobs: systemAdminProcedure.query(async () => {
    return checkOrphanedJobs();
  }),

  cleanupOrphanedJobs: systemAdminProcedure.mutation(async () => {
    const cleaned = await cleanupBeforeNewPipeline();
    return { cleaned };
  }),
});
