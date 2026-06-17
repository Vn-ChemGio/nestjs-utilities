export type ChannelType = 'email' | 'sms' | 'firebase' | 'telegram';

export type NotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'expired';

export interface Attachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface SendNotificationInput {
  channel: ChannelType;
  to: string | string[];
  subject?: string;
  template?: string;
  context?: Record<string, unknown>;
  content?: string;
  sender?: string;
  attachments?: Attachment[];
  expiresAt?: Date | string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  id: string;
  channel: ChannelType;
  to: string | string[];
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: Date;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export interface EmailChannelConfig {
  smtp?: SmtpConfig;
  transport?: string | Record<string, unknown>;
  defaults?: {
    from?: string;
    replyTo?: string;
  };
}

export interface SmsChannelConfig {
  provider: 'twilio' | 'aws-sns' | 'http';
  credentials: Record<string, string>;
  from?: string;
}

export interface FirebaseChannelConfig {
  serviceAccountPath?: string;
  serviceAccount?: Record<string, unknown>;
  databaseURL?: string;
}

export interface TelegramChannelConfig {
  botToken: string;
  apiBaseUrl?: string;
}

export interface StorageConfig {
  enabled: boolean;
}

export interface NotificationLogRecord {
  id: string;
  channel: ChannelType;
  to: string | string[];
  subject?: string;
  status: NotificationStatus;
  content?: string;
  messageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export type ChannelConfig<T> = T | T[];

export interface NotificationModuleOptions {
  channels?: {
    email?: ChannelConfig<EmailChannelConfig>;
    sms?: ChannelConfig<SmsChannelConfig>;
    firebase?: ChannelConfig<FirebaseChannelConfig>;
    telegram?: ChannelConfig<TelegramChannelConfig>;
  };
  templates?: {
    dir?: string;
  };
  queue?: {
    enabled: boolean;
    name?: string;
    connection?: { url: string };
    prefix?: string;
    defaultJobOptions?: Record<string, unknown>;
  };
  storage?: StorageConfig;
}
