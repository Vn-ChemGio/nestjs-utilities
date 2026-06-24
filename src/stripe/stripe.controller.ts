import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Headers,
  Req,
  Query,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { STRIPE_WEBHOOK_HANDLERS } from './stripe.constants';
import type {
  StripeWebhookHandler,
  SubscriptionStatus,
  PaymentMethodType,
} from './interfaces';
import type { Request } from 'express';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    @Optional()
    @Inject(STRIPE_WEBHOOK_HANDLERS)
    private readonly webhookHandlers: StripeWebhookHandler[] = [],
  ) {}

  @Post('webhook')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = (req as unknown as Record<string, unknown>).rawBody as
      | string
      | Buffer
      | undefined;
    const payload: string | Buffer = rawBody ?? (req.body as string | Buffer);
    if (!payload || !signature) {
      throw new Error('Missing webhook payload or signature');
    }

    const event = this.stripeService.constructWebhookEvent(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      signature,
    );

    this.logger.log(`Webhook received: ${event.type}`);

    await Promise.all(
      this.webhookHandlers.map((handler: StripeWebhookHandler) =>
        Promise.resolve(handler(event)),
      ),
    );

    return { received: true };
  }

  @Post('payment-intents')
  @ApiOperation({ summary: 'Create a payment intent' })
  async createPaymentIntent(
    @Body()
    body: {
      amount: number;
      currency: string;
      customerId?: string;
      paymentMethodId?: string;
      paymentMethodTypes?: PaymentMethodType[];
      description?: string;
      confirm?: boolean;
      captureMethod?: 'automatic' | 'manual';
      returnUrl?: string;
      metadata?: Record<string, string>;
      idempotencyKey?: string;
    },
  ) {
    return this.stripeService.createPaymentIntent(body);
  }

  @Post('payment-intents/:id/confirm')
  @ApiOperation({ summary: 'Confirm a payment intent' })
  async confirmPaymentIntent(
    @Param('id') id: string,
    @Body() body: { paymentMethodId?: string; returnUrl?: string },
  ) {
    return this.stripeService.confirmPaymentIntent({
      paymentIntentId: id,
      ...body,
    });
  }

  @Post('payment-intents/:id/capture')
  @ApiOperation({ summary: 'Capture a payment intent' })
  async capturePaymentIntent(
    @Param('id') id: string,
    @Body() body: { amountToCapture?: number },
  ) {
    return this.stripeService.capturePaymentIntent({
      paymentIntentId: id,
      ...body,
    });
  }

  @Post('payment-intents/:id/cancel')
  @ApiOperation({ summary: 'Cancel a payment intent' })
  async cancelPaymentIntent(
    @Param('id') id: string,
    @Body() body: { cancellationReason?: string },
  ) {
    return this.stripeService.cancelPaymentIntent(id, body.cancellationReason);
  }

  @Get('payment-intents/:id')
  @ApiOperation({ summary: 'Retrieve a payment intent' })
  async retrievePaymentIntent(@Param('id') id: string) {
    return this.stripeService.retrievePaymentIntent(id);
  }

  @Get('payment-intents')
  @ApiOperation({ summary: 'List payment intents for customer' })
  async listPaymentIntents(
    @Query('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    return this.stripeService.listPaymentIntents(
      customerId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Post('refunds')
  @ApiOperation({ summary: 'Create a refund (full or partial)' })
  async createRefund(
    @Body()
    body: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
      metadata?: Record<string, string>;
    },
  ) {
    return this.stripeService.createRefund(body);
  }

  @Get('refunds')
  @ApiOperation({ summary: 'List refunds' })
  async listRefunds(@Query('paymentIntentId') paymentIntentId?: string) {
    return this.stripeService.listRefunds(paymentIntentId);
  }

  @Post('refunds/:id/cancel')
  @ApiOperation({ summary: 'Cancel a refund' })
  async cancelRefund(@Param('id') id: string) {
    return this.stripeService.cancelRefund(id);
  }

  @Get('customers/:id/payment-methods')
  @ApiOperation({ summary: 'List payment methods for customer' })
  async listPaymentMethods(
    @Param('id') id: string,
    @Query('type') type?: string,
  ) {
    return this.stripeService.listPaymentMethods(id, type);
  }

  @Post('payment-methods/:id/attach')
  @ApiOperation({ summary: 'Attach payment method to customer' })
  async attachPaymentMethod(
    @Param('id') id: string,
    @Body() body: { customerId: string },
  ) {
    return this.stripeService.attachPaymentMethod({
      paymentMethodId: id,
      customerId: body.customerId,
    });
  }

  @Post('payment-methods/:id/detach')
  @ApiOperation({ summary: 'Detach payment method from customer' })
  async detachPaymentMethod(@Param('id') id: string) {
    return this.stripeService.detachPaymentMethod(id);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a Stripe customer' })
  async createCustomer(
    @Body() body: { email: string; name?: string; phone?: string },
  ) {
    return this.stripeService.createCustomer(body);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get a Stripe customer' })
  async getCustomer(@Param('id') id: string) {
    return this.stripeService.getCustomer(id);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a subscription' })
  async createSubscription(
    @Body()
    body: {
      customerId: string;
      priceId: string;
      trialDays?: number;
      metadata?: Record<string, string>;
    },
  ) {
    return this.stripeService.createSubscription(body);
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get subscription status' })
  async getSubscription(@Param('id') id: string): Promise<SubscriptionStatus> {
    return this.stripeService.getSubscription(id);
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  async cancelSubscription(@Param('id') id: string) {
    return this.stripeService.cancelSubscription(id);
  }

  @Patch('subscriptions/:id')
  @ApiOperation({ summary: 'Update a subscription' })
  async updateSubscription(
    @Param('id') id: string,
    @Body()
    body: {
      priceId?: string;
      trialDays?: number;
      metadata?: Record<string, string>;
    },
  ) {
    return this.stripeService.updateSubscription(id, body);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create a checkout session' })
  async createCheckoutSession(
    @Body()
    body: {
      customerId: string;
      priceId: string;
      mode?: 'subscription' | 'payment' | 'setup';
      successUrl: string;
      cancelUrl: string;
      trialDays?: number;
      allowPromotionCodes?: boolean;
      currency?: string;
      paymentMethodTypes?: PaymentMethodType[];
      metadata?: Record<string, string>;
    },
  ) {
    return this.stripeService.createCheckoutSession(body);
  }

  @Post('billing-portal')
  @ApiOperation({ summary: 'Create billing portal session' })
  async createBillingPortalSession(
    @Body() body: { customerId: string; returnUrl: string },
  ) {
    return this.stripeService.createBillingPortalSession(
      body.customerId,
      body.returnUrl,
    );
  }

  @Get('products')
  @ApiOperation({ summary: 'List active products' })
  async listProducts() {
    return this.stripeService.listProducts();
  }

  @Get('prices')
  @ApiOperation({ summary: 'List active prices' })
  async listPrices(@Query('productId') productId?: string) {
    return this.stripeService.listPrices(productId);
  }
}
