/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SendNotificationInput, SendResult } from './interfaces';
import type { NotificationChannel } from './channels';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LOG_REPOSITORY,
} from './notification.constants';
import { TemplateService } from './services';
import { NotificationQueueService } from './queue';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: Map<string, NotificationChannel[]>,
    @Optional()
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly repository: any,
    @Optional()
    private readonly templateService?: TemplateService,
    @Optional()
    private readonly queueService?: NotificationQueueService,
  ) {}

  async send(input: SendNotificationInput): Promise<SendResult> {
    const providers = this.channels.get(input.channel);
    if (!providers?.length) {
      return {
        id: '',
        channel: input.channel,
        to: input.to,
        success: false,
        error: `Channel "${input.channel}" not configured. Available: ${[...this.channels.keys()].join(', ')}`,
        sentAt: new Date(),
      };
    }

    let content = input.content;
    const id = randomUUID();

    if (input.template && this.templateService) {
      try {
        content = await this.templateService.render(
          input.template,
          input.context ?? {},
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: '',
          channel: input.channel,
          to: input.to,
          success: false,
          error: `Template render failed: ${message}`,
          sentAt: new Date(),
        };
      }
    }

    if (this.repository) {
      await this.repository.insert({
        id,
        channel: input.channel,
        to: input.to,
        subject: input.subject,
        status: 'sending',
        content,
        metadata: input.metadata,
      });
    }

    let lastError: string | undefined;
    for (const provider of providers) {
      const result = await provider.send({ ...input, content });
      if (result.success) {
        if (this.repository) {
          await this.repository.update(id, {
            status: 'sent',
            messageId: result.messageId ?? null,
            error: null,
            sentAt: new Date(),
          });
        }
        return {
          id,
          channel: input.channel,
          to: input.to,
          success: true,
          messageId: result.messageId,
          sentAt: new Date(),
        };
      }
      lastError = result.error;
    }

    if (this.repository) {
      await this.repository.update(id, {
        status: 'failed',
        error: lastError ?? null,
        sentAt: null,
      });
    }

    return {
      id,
      channel: input.channel,
      to: input.to,
      success: false,
      error: lastError,
      sentAt: new Date(),
    };
  }

  async enqueue(input: SendNotificationInput): Promise<SendResult> {
    if (!this.queueService) {
      this.logger.warn('Queue not configured, sending immediately');
      return this.send(input);
    }

    const id = randomUUID();
    const providers = this.channels.get(input.channel);
    if (!providers?.length) {
      return {
        id: '',
        channel: input.channel,
        to: input.to,
        success: false,
        error: `Channel "${input.channel}" not configured`,
        sentAt: new Date(),
      };
    }

    let content = input.content;

    if (input.template && this.templateService) {
      try {
        content = await this.templateService.render(
          input.template,
          input.context ?? {},
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          id: '',
          channel: input.channel,
          to: input.to,
          success: false,
          error: `Template render failed: ${message}`,
          sentAt: new Date(),
        };
      }
    }

    if (this.repository) {
      await this.repository.insert({
        id,
        channel: input.channel,
        to: input.to,
        subject: input.subject,
        status: 'pending',
        content,
        metadata: input.metadata,
      });
    }

    await this.queueService.enqueue({
      notification: { ...input, content },
      id,
      createdAt: new Date().toISOString(),
    });

    return {
      id,
      channel: input.channel,
      to: input.to,
      success: true,
      sentAt: new Date(),
    };
  }
}
