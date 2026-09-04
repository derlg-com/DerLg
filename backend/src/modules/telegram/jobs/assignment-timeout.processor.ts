import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { AssignmentTimeoutJobData } from './job-payloads';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AssignmentStatus } from '@prisma/client';

@Processor('assignment-timeout')
export class AssignmentTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(AssignmentTimeoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<AssignmentTimeoutJobData>): Promise<unknown> {
    const { assignmentId } = job.data;

    this.logger.log(`Processing assignment timeout for ${assignmentId}`);

    const assignment = await this.prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      this.logger.warn(`Assignment ${assignmentId} not found`);
      return { action: 'not_found' };
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      this.logger.log(
        `Assignment ${assignmentId} already ${assignment.status}, skipping auto-reject`,
      );
      return { action: 'already_responded', status: assignment.status };
    }

    // Auto-reject after 5 minutes
    const updated = await this.prisma.driverAssignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.REJECTED,
        responseTimestamp: new Date(),
        rejectionReason: 'Auto-rejected: no response within 5 minutes',
      },
    });

    // Notify Admin Panel via Redis
    await this.redis.getClient().publish(
      'driver_assignments',
      JSON.stringify({
        event: 'ASSIGNMENT_AUTO_REJECTED',
        assignmentId: updated.id,
        driverId: updated.driverId,
        bookingId: updated.bookingId,
        reason: updated.rejectionReason,
        timestamp: new Date().toISOString(),
      }),
    );

    this.logger.log(`Assignment ${assignmentId} auto-rejected`);

    return { action: 'auto_rejected', assignmentId };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Assignment timeout job ${job.id} failed: ${err.message}`,
    );
  }
}
