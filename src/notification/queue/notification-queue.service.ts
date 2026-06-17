/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  Logger,
} from '@nestjs/common';
import type { SendNotificationInput } from '../interfaces';
import type { NotificationChannel } from '../channels';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LOG_REPOSITORY,
  NOTIFICATION_QUEUE_OPTIONS,
} from '../notification.constants';
import { TemplateService } from '../services';

export interface QueueConfig {
  name: string;
  connection: { url: string };
  defaultJobOptions?: Record<string, unknown>;
}

export interface QueueJobData {
  notification: SendNotificationInput;
  id: string;
  createdAt: string;
}

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue: any = null;
  private worker: any = null;
  private initialized = false;

  constructor(
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: Map<string, NotificationChannel[]>,
    @Inject(NOTIFICATION_QUEUE_OPTIONS)
    private readonly queueConfig: QueueConfig,
    @Optional()
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repository: any,
    @Optional()
    private readonly templateService?: TemplateService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { Queue, Worker } = await import('bullmq');
    const { connection, name, defaultJobOptions } = this.queueConfig;

    this.queue = new Queue(name, {
      connection,
      defaultJobOptions,
    });

    this.worker = new Worker(
      name,
      async (job: any) => {
        await this.processJob(job.data as QueueJobData);
      },
      { connection },
    );

    this.worker.on('failed', (job: any, err: Error) => {
      this.logger.error(`Queue job ${job?.id} failed: ${err.message}`);
    });

    this.initialized = true;
    this.logger.log(`Queue worker initialized: ${name}`);
  }

  async enqueue(data: QueueJobData): Promise<void> {
    if (!this.initialized || !this.queue) {
      throw new Error(
        'Queue not initialized. Ensure queue is enabled in NotificationModule.forRoot().',
      );
    }

    await this.queue.add(data.notification.channel, data, {
      jobId: data.id,
      ...this.queueConfig.defaultJobOptions,
    });
  }

  private async processJob(data: QueueJobData): Promise<void> {
    const { notification, id } = data;

    if (notification.expiresAt) {
      const expiresAt =
        typeof notification.expiresAt === 'string'
          ? new Date(notification.expiresAt)
          : notification.expiresAt;

      if (expiresAt <= new Date()) {
        this.logger.warn(`Notification ${id} expired, skipping`);
        if (this.repository) {
          await this.repository.update(id, { status: 'expired' });
        }
        return;
      }
    }

    const providers = this.channels.get(notification.channel);
    if (!providers?.length) {
      this.logger.error(`Channel "${notification.channel}" not configured`);
      if (this.repository) {
        await this.repository.update(id, {
          status: 'failed',
          error: `Channel "${notification.channel}" not configured`,
        });
      }
      return;
    }

    let content = notification.content;
    if (notification.template && this.templateService) {
      content = await this.templateService.render(
        notification.template,
        notification.context ?? {},
      );
    }

    if (this.repository) {
      await this.repository.update(id, { status: 'sending', content });
    }

    let lastError: string | undefined;
    for (const provider of providers) {
      const result = await provider.send({ ...notification, content });
      if (result.success) {
        if (this.repository) {
          await this.repository.update(id, {
            status: 'sent',
            messageId: result.messageId ?? null,
            error: null,
            sentAt: new Date(),
          });
        }
        return;
      }
      lastError = result.error;
    }

    if (this.repository) {
      await this.repository.update(id, {
        status: 'failed',
        error: lastError ?? null,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
