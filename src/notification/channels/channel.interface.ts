import type { SendNotificationInput } from '../interfaces';

export interface SendChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationChannel {
  readonly channelType: string;
  send(input: SendNotificationInput): Promise<SendChannelResult>;
}
