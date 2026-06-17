import type { ConfigService } from '@nestjs/config';

export interface QueueModuleOptions {
  store?: 'valkey' | 'redis';
  prefix?: string;
  defaultJobOptions?: Record<string, unknown>;
}

export interface BullMQModuleOptions {
  connection: { url: string };
  prefix: string;
  defaultJobOptions?: Record<string, unknown>;
}

export function configBullMQ(
  configService: ConfigService,
  options?: QueueModuleOptions,
): BullMQModuleOptions {
  const { store = 'valkey', prefix, defaultJobOptions } = options ?? {};
  const envKey = store === 'valkey' ? 'VALKEY_URL' : 'REDIS_URL';
  const url = configService.get<string>(envKey);
  if (!url) {
    throw new Error(`Missing ${envKey} environment variable.`);
  }
  return {
    connection: { url },
    prefix: prefix ?? '{default}',
    defaultJobOptions,
  };
}
