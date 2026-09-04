import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { BroadcastJobData } from './job-payloads';
import { PrismaService } from '../../prisma/prisma.service';
import { BotSenderService } from '../services/bot-sender.service';

@Processor('broadcast')
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botSender: BotSenderService,
  ) {
    super();
  }

  async process(job: Job<BroadcastJobData>): Promise<unknown> {
    const { broadcastId, targets, imageUrl } = job.data;

    this.logger.log(
      `Processing broadcast ${broadcastId} with ${targets.length} targets`,
    );

    let sentCount = 0;
    let failedCount = 0;
    const rateLimitMs = 1000 / 30; // 30 msg/sec

    for (const target of targets) {
      try {
        if (imageUrl) {
          await this.botSender.sendPhoto(
            target.chatId,
            imageUrl,
            target.message,
            {
              parseMode: 'HTML',
            },
          );
        } else {
          await this.botSender.sendMessage(target.chatId, target.message, {
            parseMode: 'HTML',
          });
        }
        sentCount++;
      } catch (error) {
        this.logger.warn(
          `Failed to send broadcast to ${target.chatId}: ${(error as Error).message}`,
        );
        failedCount++;
      }

      // Rate limiting: 30 msg/sec
      await this.sleep(rateLimitMs);
    }

    // Update broadcast record
    await this.prisma.broadcastMessage.update({
      where: { id: broadcastId },
      data: {
        sentCount: { increment: sentCount },
        failedCount: { increment: failedCount },
        status:
          sentCount + failedCount >= targets.length ? 'COMPLETED' : undefined,
        completedAt:
          sentCount + failedCount >= targets.length ? new Date() : undefined,
      },
    });

    return { sentCount, failedCount };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Broadcast job ${job.id} failed: ${err.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
