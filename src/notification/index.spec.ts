import { Test, TestingModule } from '@nestjs/testing';
import { NotificationModule } from './notification.module';
import { NotificationService } from './notification.service';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LOG_REPOSITORY,
} from './notification.constants';
import { NotificationLog } from './entities/notification-log.entity';

class FakeEmailChannel {
  readonly channelType = 'email';
  send() {
    return Promise.resolve({ success: true, messageId: 'msg_123' });
  }
}

class FakeSmsChannel {
  readonly channelType = 'sms';
  send() {
    return Promise.resolve({ success: false, error: 'sms failed' });
  }
}

describe('nesthub/notification', () => {
  describe('NotificationModule.forRoot', () => {
    it('should return a DynamicModule', () => {
      const mod = NotificationModule.forRoot({
        channels: {
          email: { smtp: { host: 'localhost', port: 1025 } },
        },
      });

      expect(mod.module).toBe(NotificationModule);
      expect(mod.providers).toBeDefined();
      expect(mod.exports).toContain(NotificationService);
    });

    it('should work without any channels', () => {
      const mod = NotificationModule.forRoot();
      expect(mod.module).toBe(NotificationModule);
    });

    it('should accept multiple email providers', () => {
      const mod = NotificationModule.forRoot({
        channels: {
          email: [
            { smtp: { host: 'smtp1.example.com', port: 587 } },
            { smtp: { host: 'smtp2.example.com', port: 587 } },
          ],
        },
      });

      const channels = (mod.providers as any[]).find(
        (p) => p.provide === NOTIFICATION_CHANNELS,
      )?.useValue;

      expect(channels.get('email')).toHaveLength(2);
    });

    it('should register queue provider when queue is enabled', () => {
      const mod = NotificationModule.forRoot({
        queue: {
          enabled: true,
          connection: { url: 'valkey://localhost:6379' },
        },
      });

      const tokens = (mod.providers ?? []).map((p: any) =>
        typeof p === 'function' ? p.name : p.provide,
      );
      expect(tokens).toContain('NOTIFICATION_QUEUE_OPTIONS');
    });

    it('should not register queue when disabled', () => {
      const mod = NotificationModule.forRoot({ queue: { enabled: false } });
      const tokens = (mod.providers ?? []).map((p: any) =>
        typeof p === 'function' ? p.name : p.provide,
      );
      expect(tokens).not.toContain('NOTIFICATION_QUEUE_OPTIONS');
    });

    it('should register storage error provider when enabled', () => {
      const mod = NotificationModule.forRoot({ storage: { enabled: true } });
      const tokens = (mod.providers ?? []).map((p: any) =>
        typeof p === 'function' ? p.name : p.provide,
      );
      expect(tokens).toContain('NOTIFICATION_LOG_REPOSITORY');
    });
  });

  describe('NotificationModule.forRootAsync', () => {
    it('should return a DynamicModule with factory', () => {
      const mod = NotificationModule.forRootAsync({
        useFactory: () => ({
          channels: {
            email: { smtp: { host: 'localhost', port: 1025 } },
          },
        }),
      });

      expect(mod.module).toBe(NotificationModule);
      expect(mod.exports).toContain(NotificationService);
    });

    it('should wire providers via DI', async () => {
      const mod = NotificationModule.forRootAsync({
        useFactory: () => ({
          channels: {
            email: { smtp: { host: 'smtp.example.com', port: 587 } },
          },
        }),
      });

      const testMod = await Test.createTestingModule({
        imports: [mod],
      }).compile();

      const svc = testMod.get(NotificationService);
      expect(svc).toBeDefined();
    });

    it('should accept inject tokens', () => {
      const mod = NotificationModule.forRootAsync({
        useFactory: (config: any) => ({
          channels: {
            email: {
              smtp: { host: config.get('HOST'), port: config.get('PORT') },
            },
          },
        }),
        inject: ['SOME_TOKEN'],
      });

      const optProvider = (mod.providers as any[]).find(
        (p: any) => p.provide === 'NOTIFICATION_OPTIONS',
      );
      expect(optProvider).toBeDefined();
      expect(optProvider.inject).toEqual(['SOME_TOKEN']);
      expect(optProvider.useFactory).toBeInstanceOf(Function);
    });
  });

  describe('NotificationService.send', () => {
    let service: NotificationService;
    const channels = new Map<string, any[]>();
    channels.set('email', [new FakeEmailChannel()]);

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationService,
          { provide: NOTIFICATION_CHANNELS, useValue: channels },
        ],
      }).compile();

      service = module.get<NotificationService>(NotificationService);
    });

    it('should send via first working provider', async () => {
      const result = await service.send({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Test',
        content: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.id).toBeTruthy();
    });

    it('should fail for unconfigured channel', async () => {
      const result = await service.send({
        channel: 'sms',
        to: '+84123456789',
        content: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should try next provider on failure', async () => {
      const ch = new Map<string, any[]>();
      ch.set('sms', [new FakeSmsChannel(), new FakeEmailChannel()]);

      const mod = await Test.createTestingModule({
        providers: [
          NotificationService,
          { provide: NOTIFICATION_CHANNELS, useValue: ch },
        ],
      }).compile();

      const svc = mod.get<NotificationService>(NotificationService);
      const result = await svc.send({
        channel: 'sms',
        to: '+84123456789',
        content: 'Hello',
      });

      expect(result.success).toBe(true);
    });

    it('should log to repository if provided', async () => {
      const repo = { insert: jest.fn(), update: jest.fn() };

      const mod = await Test.createTestingModule({
        providers: [
          NotificationService,
          { provide: NOTIFICATION_CHANNELS, useValue: channels },
          { provide: NOTIFICATION_LOG_REPOSITORY, useValue: repo },
        ],
      }).compile();

      const svc = mod.get<NotificationService>(NotificationService);
      const result = await svc.send({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Test',
        content: 'Hello',
      });

      expect(repo.insert).toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('NotificationService.enqueue', () => {
    it('should fall back to send when queue is not configured', async () => {
      const channels = new Map<string, any[]>();
      channels.set('email', [new FakeEmailChannel()]);

      const mod = await Test.createTestingModule({
        providers: [
          NotificationService,
          { provide: NOTIFICATION_CHANNELS, useValue: channels },
        ],
      }).compile();

      const svc = mod.get<NotificationService>(NotificationService);
      const result = await svc.enqueue({
        channel: 'email',
        to: 'test@example.com',
        content: 'Hello',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('NotificationLog entity', () => {
    it('should be defined', () => {
      expect(NotificationLog).toBeDefined();
    });
  });
});
