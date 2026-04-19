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
  drainQueue,
  getRedisInfo,
  writeAuditLog,
  getAuditLogs,
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
      await writeAuditLog({ action: 'pause', target: input.queueName, result: 'success' });
      return { paused: true, queue: input.queueName };
    }),

  resumeQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await resumeQueue(input.queueName);
      await writeAuditLog({ action: 'resume', target: input.queueName, result: 'success' });
      return { resumed: true, queue: input.queueName };
    }),

  drainQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await drainQueue(input.queueName);
      await writeAuditLog({ action: 'drain', target: input.queueName, result: 'success' });
      return { drained: true, queue: input.queueName };
    }),

  removeStalledJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeStalledJobs(input.jobs);
      await writeAuditLog({
        action: 'remove-stalled',
        target: `${input.jobs.length} jobs`,
        result: 'success',
        count: removed,
      });
      return { removed };
    }),

  retryFailedJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const retried = await retryFailedJob(input.bullmqId, input.queue);
    await writeAuditLog({
      action: 'retry-failed',
      target: `${input.queue}:${input.bullmqId}`,
      result: retried ? 'success' : 'not-found',
    });
    return { retried };
  }),

  removeFailedJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeFailedJobs(input.jobs);
      await writeAuditLog({
        action: 'remove-failed',
        target: `${input.jobs.length} jobs`,
        result: 'success',
        count: removed,
      });
      return { removed };
    }),

  removeJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const removed = await removeJob(input.bullmqId, input.queue);
    await writeAuditLog({
      action: 'remove-job',
      target: `${input.queue}:${input.bullmqId}`,
      result: removed ? 'success' : 'not-found',
    });
    return { removed };
  }),

  checkOrphanedJobs: systemAdminProcedure.query(async () => {
    return checkOrphanedJobs();
  }),

  cleanupOrphanedJobs: systemAdminProcedure.mutation(async () => {
    const cleaned = await cleanupBeforeNewPipeline();
    await writeAuditLog({
      action: 'cleanup-orphaned',
      target: 'all queues',
      result: 'success',
      count: cleaned,
    });
    return { cleaned };
  }),

  getRedisInfo: systemAdminProcedure.query(async () => {
    return getRedisInfo();
  }),

  getAuditLogs: systemAdminProcedure.query(async () => {
    return getAuditLogs();
  }),
});
