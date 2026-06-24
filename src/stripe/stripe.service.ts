import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { STRIPE_CLIENT, STRIPE_MODULE_OPTIONS } from './stripe.constants';
import type Stripe from 'stripe';
import type {
  StripeModuleOptions,
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateCheckoutInput,
  SubscriptionStatus,
  InvoiceResult,
  CreatePaymentIntentInput,
  ConfirmPaymentIntentInput,
  CapturePaymentIntentInput,
  CreateRefundInput,
  AttachPaymentMethodInput,
  PaymentMethodResult,
  PaymentIntentResult,
  RefundResult,
  PaymentTransaction,
  RefundRecord,
  RefundStatus,
  PaymentIntentStatus,
} from './interfaces';
import { PaymentStore } from './interfaces';
import { VALID_TRANSITIONS } from './interfaces';

type StripeClient = Stripe;

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,
    @Inject(STRIPE_MODULE_OPTIONS)
    private readonly options: StripeModuleOptions,
    @Optional()
    private readonly store?: PaymentStore,
  ) {}

  private get defaultCurrency(): string {
    return (this.options.defaultCurrency ?? 'usd').toLowerCase();
  }

  private makeIdempotencyKey(key: string): string | undefined {
    if (!this.options.idempotencyTtlMs) return undefined;
    return `nesthub_${key}`;
  }

  private async validateTransition(
    paymentIntentId: string,
    nextStatus: PaymentIntentStatus,
  ): Promise<void> {
    if (!this.store) return;
    const tx = await this.store.getTransaction(paymentIntentId);
    if (!tx) return;
    const currentStatus = tx.status;
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed?.includes(nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${currentStatus} → ${nextStatus}`,
      );
    }
  }

  private async recordTransaction(
    paymentIntentId: string,
    data: Partial<PaymentTransaction>,
  ): Promise<void> {
    if (!this.store) return;
    const now = new Date().toISOString();
    const existing = await this.store.getTransaction(paymentIntentId);
    if (existing) {
      await this.store.updateTransaction(paymentIntentId, {
        ...data,
        updatedAt: now,
      });
    } else {
      await this.store.saveTransaction({
        id: paymentIntentId,
        paymentIntentId,
        amount: data.amount ?? 0,
        currency: data.currency ?? this.defaultCurrency,
        status: data.status ?? 'requires_payment_method',
        customerId: data.customerId,
        paymentMethodId: data.paymentMethodId,
        description: data.description,
        metadata: data.metadata,
        error: data.error,
        idempotencyKey: data.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private mapPaymentMethod(pm: Stripe.PaymentMethod): PaymentMethodResult {
    return {
      id: pm.id,
      customerId: typeof pm.customer === 'string' ? pm.customer : undefined,
      type: pm.type,
      billingDetails: pm.billing_details
        ? {
            name: pm.billing_details.name ?? undefined,
            email: pm.billing_details.email ?? undefined,
            phone: pm.billing_details.phone ?? undefined,
          }
        : undefined,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : undefined,
      wallet: pm.card?.wallet
        ? { type: pm.card.wallet.type ?? 'unknown' }
        : undefined,
      ideal: pm.ideal ? { bank: pm.ideal.bank ?? '' } : undefined,
      sepaDebit: pm.sepa_debit
        ? {
            last4: pm.sepa_debit.last4 ?? '',
            bankCode: pm.sepa_debit.bank_code ?? '',
          }
        : undefined,
      usBankAccount: pm.us_bank_account
        ? {
            bankName: pm.us_bank_account.bank_name ?? '',
            last4: pm.us_bank_account.last4 ?? '',
          }
        : undefined,
      metadata: pm.metadata as Record<string, string> | undefined,
      createdAt: new Date(pm.created * 1000).toISOString(),
    };
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    const idempotencyKey =
      input.idempotencyKey ?? this.makeIdempotencyKey(`pi_${Date.now()}`);
    const paymentMethodTypes = input.paymentMethodTypes?.length
      ? input.paymentMethodTypes
      : ['card'];

    const pi = await this.stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        payment_method_types: paymentMethodTypes,
        description: input.description,
        metadata: { ...this.options.metadata, ...input.metadata },
        confirm: input.confirm,
        capture_method: input.captureMethod,
        return_url: input.returnUrl,
        off_session: input.offSession,
      },
      { idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined },
    );

    await this.recordTransaction(pi.id, {
      paymentIntentId: pi.id,
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      status: pi.status as PaymentIntentStatus,
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
      description: input.description,
      metadata: input.metadata,
      idempotencyKey: String(idempotencyKey),
    });

    return this.toPaymentIntentResult(pi);
  }

  async confirmPaymentIntent(
    input: ConfirmPaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    await this.validateTransition(
      input.paymentIntentId,
      'requires_confirmation',
    );

    const idempotencyKey =
      input.idempotencyKey ??
      this.makeIdempotencyKey(`confirm_${input.paymentIntentId}`);
    const pi = await this.stripe.paymentIntents.confirm(
      input.paymentIntentId,
      {
        payment_method: input.paymentMethodId,
        return_url: input.returnUrl,
      },
      { idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined },
    );

    await this.recordTransaction(pi.id, {
      paymentIntentId: pi.id,
      status: pi.status as PaymentIntentStatus,
      paymentMethodId: pi.payment_method as string | undefined,
    });

    return this.toPaymentIntentResult(pi);
  }

  async capturePaymentIntent(
    input: CapturePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    await this.validateTransition(input.paymentIntentId, 'processing');

    const idempotencyKey =
      input.idempotencyKey ??
      this.makeIdempotencyKey(`capture_${input.paymentIntentId}`);
    const pi = await this.stripe.paymentIntents.capture(
      input.paymentIntentId,
      input.amountToCapture
        ? { amount_to_capture: input.amountToCapture }
        : undefined,
      { idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined },
    );

    await this.recordTransaction(pi.id, {
      paymentIntentId: pi.id,
      status: pi.status as PaymentIntentStatus,
    });

    return this.toPaymentIntentResult(pi);
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
    cancellationReason?: string,
    idempotencyKey?: string,
  ): Promise<PaymentIntentResult> {
    await this.validateTransition(paymentIntentId, 'canceled');

    const key =
      idempotencyKey ?? this.makeIdempotencyKey(`cancel_${paymentIntentId}`);
    const pi = await this.stripe.paymentIntents.cancel(
      paymentIntentId,
      cancellationReason
        ? {
            cancellation_reason:
              cancellationReason as Stripe.PaymentIntentCancelParams.CancellationReason,
          }
        : undefined,
      { idempotencyKey: key ? String(key) : undefined },
    );

    await this.recordTransaction(pi.id, {
      paymentIntentId: pi.id,
      status: pi.status as PaymentIntentStatus,
    });

    return this.toPaymentIntentResult(pi);
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<PaymentIntentResult> {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return this.toPaymentIntentResult(pi);
  }

  async listPaymentIntents(
    customerId: string,
    limit = 10,
  ): Promise<PaymentIntentResult[]> {
    const intents = await this.stripe.paymentIntents.list({
      customer: customerId,
      limit,
    });
    return intents.data.map((pi) => this.toPaymentIntentResult(pi));
  }

  async createRefund(input: CreateRefundInput): Promise<RefundResult> {
    const idempotencyKey =
      input.idempotencyKey ??
      this.makeIdempotencyKey(`refund_${input.paymentIntentId}_${Date.now()}`);

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        amount: input.amount,
        reason: input.reason as Stripe.RefundCreateParams.Reason | undefined,
        metadata: { ...this.options.metadata, ...input.metadata },
      },
      { idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined },
    );

    const record: RefundRecord = {
      id: refund.id,
      refundId: refund.id,
      paymentIntentId: input.paymentIntentId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status as unknown as RefundStatus,
      reason: input.reason,
      metadata: input.metadata,
      createdAt: new Date(refund.created * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.store) {
      await this.store.saveRefund(record);
    }

    return this.toRefundResult(refund);
  }

  async listRefunds(paymentIntentId?: string): Promise<RefundResult[]> {
    const params: Stripe.RefundListParams = {};
    if (paymentIntentId) params.payment_intent = paymentIntentId;
    const refunds = await this.stripe.refunds.list(params);
    return refunds.data.map((r) => this.toRefundResult(r));
  }

  async cancelRefund(
    refundId: string,
    idempotencyKey?: string,
  ): Promise<RefundResult> {
    const key =
      idempotencyKey ?? this.makeIdempotencyKey(`cancel_refund_${refundId}`);
    const refund = await this.stripe.refunds.cancel(
      refundId,
      {},
      key ? { idempotencyKey: key } : undefined,
    );

    if (this.store) {
      await this.store.updateRefund(refundId, {
        status: refund.status as unknown as RefundStatus,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.toRefundResult(refund);
  }

  async listPaymentMethods(
    customerId: string,
    type?: string,
  ): Promise<PaymentMethodResult[]> {
    const pms = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: (type ?? 'card') as Stripe.PaymentMethodListParams.Type,
    });
    return pms.data.map((pm) => this.mapPaymentMethod(pm));
  }

  async attachPaymentMethod(
    input: AttachPaymentMethodInput,
  ): Promise<PaymentMethodResult> {
    const pm = await this.stripe.paymentMethods.attach(input.paymentMethodId, {
      customer: input.customerId,
    });
    return this.mapPaymentMethod(pm);
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<PaymentMethodResult> {
    const pm = await this.stripe.paymentMethods.detach(paymentMethodId);
    return this.mapPaymentMethod(pm);
  }

  async createCustomer(input: CreateCustomerInput): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email: input.email,
      name: input.name,
      phone: input.phone,
      metadata: { ...this.options.metadata, ...input.metadata },
    });
  }

  async getCustomer(
    customerId: string,
  ): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    return this.stripe.customers.retrieve(customerId);
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.create({
      customer: input.customerId,
      items: [{ price: input.priceId }],
      trial_period_days: input.trialDays,
      payment_behavior: input.paymentBehavior ?? 'default_incomplete',
      metadata: input.metadata,
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async updateSubscription(
    subscriptionId: string,
    updates: {
      priceId?: string;
      trialDays?: number;
      metadata?: Record<string, string>;
    },
  ): Promise<Stripe.Subscription> {
    const items: Stripe.SubscriptionUpdateParams.Item[] = updates.priceId
      ? [{ price: updates.priceId }]
      : [];
    return this.stripe.subscriptions.update(subscriptionId, {
      items: items.length ? items : undefined,
      trial_end: updates.trialDays !== undefined ? 'now' : undefined,
      metadata: updates.metadata,
    });
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionStatus> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['schedule'],
    });
    return this.normalizeSubscription(sub);
  }

  async listSubscriptions(customerId: string): Promise<SubscriptionStatus[]> {
    const subs = await this.stripe.subscriptions.list({
      customer: customerId,
    });
    return subs.data.map((s) => this.normalizeSubscription(s));
  }

  async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<Stripe.Checkout.Session> {
    const lineItems = input.lineItems ?? [
      { price: input.priceId!, quantity: 1 },
    ];
    return this.stripe.checkout.sessions.create({
      customer: input.customerId,
      mode: input.mode ?? 'subscription',
      line_items: lineItems,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      subscription_data:
        input.mode === 'subscription'
          ? {
              trial_period_days: input.trialDays,
              metadata: input.metadata,
            }
          : undefined,
      allow_promotion_codes: input.allowPromotionCodes,
      metadata: input.metadata,
      currency: input.currency,
      payment_method_types: input.paymentMethodTypes,
    });
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getInvoices(customerId: string, limit = 10): Promise<InvoiceResult[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number ?? '',
      amountPaid: inv.amount_paid,
      amountDue: inv.amount_due,
      currency: inv.currency,
      status: inv.status ?? '',
      pdfUrl: inv.invoice_pdf ?? undefined,
      paidAt: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : undefined,
      lines: (inv.lines?.data ?? []).map((line) => ({
        description: line.description ?? '',
        amount: line.amount,
        quantity: line.quantity ?? 1,
      })),
    }));
  }

  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.options.webhookSecret ?? '',
    );
  }

  async listProducts(): Promise<Stripe.Product[]> {
    const products = await this.stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    });
    return products.data;
  }

  async listPrices(productId?: string): Promise<Stripe.Price[]> {
    const params: Record<string, unknown> = { active: true };
    if (productId) params.product = productId;
    const prices = await this.stripe.prices.list(params);
    return prices.data;
  }

  private toPaymentIntentResult(pi: Stripe.PaymentIntent): PaymentIntentResult {
    return {
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status as PaymentIntentStatus,
      customerId: typeof pi.customer === 'string' ? pi.customer : undefined,
      paymentMethodId:
        typeof pi.payment_method === 'string' ? pi.payment_method : undefined,
      clientSecret: pi.client_secret ?? undefined,
      nextAction: pi.next_action
        ? {
            type: pi.next_action.type,
            redirectUrl: pi.next_action.redirect_to_url?.url ?? undefined,
          }
        : undefined,
      lastPaymentError: pi.last_payment_error?.message ?? undefined,
      metadata: pi.metadata,
      createdAt: new Date(pi.created * 1000).toISOString(),
    };
  }

  private toRefundResult(refund: Stripe.Refund): RefundResult {
    return {
      id: refund.id,
      paymentIntentId:
        typeof refund.payment_intent === 'string'
          ? refund.payment_intent
          : (refund.payment_intent?.id ?? ''),
      amount: refund.amount,
      currency: refund.currency,
      status: String(refund.status) as RefundStatus,
      reason: refund.reason ?? undefined,
      metadata: refund.metadata as Record<string, string> | undefined,
      createdAt: new Date(refund.created * 1000).toISOString(),
    };
  }

  private normalizeSubscription(sub: Stripe.Subscription): SubscriptionStatus {
    const price = sub.items?.data?.[0]?.price;
    const subData = sub as unknown as {
      current_period_start: number;
      current_period_end: number;
    };
    return {
      id: sub.id,
      customerId:
        typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: sub.status,
      currentPeriodStart: new Date(subData.current_period_start * 1000),
      currentPeriodEnd: new Date(subData.current_period_end * 1000),
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      plan: price
        ? {
            id: price.id,
            product:
              typeof price.product === 'string'
                ? price.product
                : price.product.id,
            amount: price.unit_amount ?? 0,
            currency: price.currency,
            interval: price.recurring?.interval as
              | 'day'
              | 'week'
              | 'month'
              | 'year',
          }
        : undefined,
    };
  }
}
