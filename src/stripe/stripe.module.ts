import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import {
  STRIPE_MODULE_OPTIONS,
  STRIPE_CLIENT,
  STRIPE_WEBHOOK_HANDLERS,
} from './stripe.constants';
import type { StripeModuleOptions, StripeWebhookHandler } from './interfaces';
import { PaymentStore } from './interfaces';
import { StripeSandboxClient } from './stripe-sandbox.client';
import {
  TypeOrmPaymentStore,
  PaymentTransactionEntity,
  RefundRecordEntity,
  StripeLockEntity,
} from './store';

function createStripeClientProvider() {
  return {
    provide: STRIPE_CLIENT,
    inject: [STRIPE_MODULE_OPTIONS],
    useFactory: async (options: StripeModuleOptions) => {
      if (options.sandbox) {
        return new StripeSandboxClient();
      }
      const { default: StripeConstructor } = await import('stripe');
      return new StripeConstructor(options.apiKey, {
        apiVersion: '2026-05-27.dahlia' as const,
      });
    },
  };
}

@Global()
@Module({})
export class StripeModule {
  static async forRoot(
    options: StripeModuleOptions & {
      webhookHandlers?: StripeWebhookHandler[];
    },
  ): Promise<DynamicModule> {
    const opts = options ?? {};
    const imports: any[] = [];
    const providers: Provider[] = [
      { provide: STRIPE_MODULE_OPTIONS, useValue: opts },
      createStripeClientProvider(),
      {
        provide: STRIPE_WEBHOOK_HANDLERS,
        useValue: opts.webhookHandlers ?? [],
      },
      StripeService,
    ];

    if (opts.store) {
      providers.push({
        provide: PaymentStore,
        useClass: opts.store,
      });
    } else {
      const { TypeOrmModule } = await import('@nestjs/typeorm');
      imports.push(
        TypeOrmModule.forFeature([
          PaymentTransactionEntity,
          RefundRecordEntity,
          StripeLockEntity,
        ]),
      );
      providers.push({
        provide: PaymentStore,
        useClass: TypeOrmPaymentStore,
      });
    }

    return {
      module: StripeModule,
      imports,
      providers,
      controllers: [StripeController],
      exports: [StripeService],
    };
  }
}
