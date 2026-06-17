import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LOG_REPOSITORY,
  NOTIFICATION_QUEUE_OPTIONS,
  NOTIFICATION_OPTIONS,
} from './notification.constants';
import { NotificationService } from './notification.service';
import { TemplateService } from './services';
import { NotificationQueueService, QueueConfig } from './queue';
import { EmailChannel } from './channels';
import { SmsChannel } from './channels';
import { FirebaseChannel } from './channels';
import { TelegramChannel } from './channels';
import type { NotificationChannel } from './channels';
import type {
  NotificationModuleOptions,
  EmailChannelConfig,
  SmsChannelConfig,
  FirebaseChannelConfig,
  TelegramChannelConfig,
} from './interfaces';

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildChannels(
  config: NotificationModuleOptions['channels'],
): Map<string, NotificationChannel[]> {
  const map = new Map<string, NotificationChannel[]>();

  const emailCfgs = toArray<EmailChannelConfig>(config?.email);
  if (emailCfgs.length)
    map.set(
      'email',
      emailCfgs.map((c) => new EmailChannel(c)),
    );

  const smsCfgs = toArray<SmsChannelConfig>(config?.sms);
  if (smsCfgs.length)
    map.set(
      'sms',
      smsCfgs.map((c) => new SmsChannel(c)),
    );

  const fbCfgs = toArray<FirebaseChannelConfig>(config?.firebase);
  if (fbCfgs.length)
    map.set(
      'firebase',
      fbCfgs.map((c) => new FirebaseChannel(c)),
    );

  const tgCfgs = toArray<TelegramChannelConfig>(config?.telegram);
  if (tgCfgs.length)
    map.set(
      'telegram',
      tgCfgs.map((c) => new TelegramChannel(c)),
    );

  return map;
}

function buildProviders(options: NotificationModuleOptions): Provider[] {
  const channelMap = buildChannels(options.channels);

  const providers: Provider[] = [
    NotificationService,
    {
      provide: NOTIFICATION_CHANNELS,
      useValue: channelMap,
    },
  ];

  if (options.templates?.dir) {
    providers.push({
      provide: TemplateService,
      useFactory: () => new TemplateService(options.templates!.dir),
    });
  }

  if (options.queue?.enabled && options.queue.connection) {
    providers.push(
      {
        provide: NOTIFICATION_QUEUE_OPTIONS,
        useValue: {
          name: options.queue.name ?? 'notification',
          connection: options.queue.connection,
          defaultJobOptions: options.queue.defaultJobOptions,
        },
      },
      NotificationQueueService,
    );
  }

  if (options.storage?.enabled) {
    providers.push({
      provide: NOTIFICATION_LOG_REPOSITORY,
      useFactory: () => {
        throw new Error(
          'Notification storage is enabled but no repository is configured. ' +
            'Provide a repository using the NOTIFICATION_LOG_REPOSITORY token. ' +
            'See README for TypeORM setup instructions.',
        );
      },
    });
  }

  return providers;
}

@Global()
@Module({})
export class NotificationModule {
  static forRoot(options: NotificationModuleOptions = {}): DynamicModule {
    return {
      module: NotificationModule,
      providers: buildProviders(options),
      exports: [NotificationService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => NotificationModuleOptions | Promise<NotificationModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    return {
      module: NotificationModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: NOTIFICATION_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        ...buildProviderFactories(),
      ],
      exports: [NotificationService],
    };
  }
}

function buildProviderFactories(): Provider[] {
  return [
    NotificationService,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [NOTIFICATION_OPTIONS],
      useFactory: (opts: NotificationModuleOptions) =>
        buildChannels(opts.channels),
    },
    {
      provide: TemplateService,
      inject: [NOTIFICATION_OPTIONS],
      useFactory: (opts: NotificationModuleOptions) =>
        opts.templates?.dir
          ? new TemplateService(opts.templates.dir)
          : undefined,
    },
    {
      provide: NOTIFICATION_QUEUE_OPTIONS,
      inject: [NOTIFICATION_OPTIONS],
      useFactory: (opts: NotificationModuleOptions) => {
        if (!opts.queue?.enabled || !opts.queue.connection) return undefined;
        return {
          name: opts.queue.name ?? 'notification',
          connection: opts.queue.connection,
          defaultJobOptions: opts.queue.defaultJobOptions,
        };
      },
    },
    {
      provide: NotificationQueueService,
      inject: [
        NOTIFICATION_CHANNELS,
        NOTIFICATION_QUEUE_OPTIONS,
        NOTIFICATION_OPTIONS,
      ],
      useFactory: (
        channelMap: Map<string, NotificationChannel[]>,
        queueOpts: QueueConfig | undefined,
        opts: NotificationModuleOptions,
      ) => {
        if (!opts.queue?.enabled || !opts.queue.connection || !queueOpts)
          return undefined;
        return new NotificationQueueService(
          channelMap,
          queueOpts,
          undefined,
          undefined,
        );
      },
    },
    {
      provide: NOTIFICATION_LOG_REPOSITORY,
      inject: [NOTIFICATION_OPTIONS],
      useFactory: (opts: NotificationModuleOptions) => {
        if (!opts.storage?.enabled) return undefined;
        throw new Error(
          'Notification storage is enabled but no repository is configured. ' +
            'Provide a repository using the NOTIFICATION_LOG_REPOSITORY token.',
        );
      },
    },
  ];
}
