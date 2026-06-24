import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { STRIPE_CLIENT, STRIPE_MODULE_OPTIONS } from './stripe.constants';
import { PaymentStore } from './interfaces';
import { StripeSandboxClient } from './stripe-sandbox.client';

const mockStore: PaymentStore = {
  saveTransaction: jest.fn().mockResolvedValue(undefined),
  updateTransaction: jest.fn().mockResolvedValue(undefined),
  getTransaction: jest.fn().mockResolvedValue(undefined),
  saveRefund: jest.fn().mockResolvedValue(undefined),
  updateRefund: jest.fn().mockResolvedValue(undefined),
  getRefund: jest.fn().mockResolvedValue(undefined),
  listRefunds: jest.fn().mockResolvedValue([]),
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(undefined),
};

const mockStripe = {
  customers: {
    create: jest
      .fn()
      .mockResolvedValue({ id: 'cus_123', email: 'test@test.com' }),
    retrieve: jest
      .fn()
      .mockResolvedValue({ id: 'cus_123', email: 'test@test.com' }),
  },
  subscriptions: {
    create: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'active' }),
    cancel: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'canceled' }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_start: 1700000000,
      current_period_end: 1700086400,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: {
              id: 'price_1',
              product: 'prod_1',
              unit_amount: 1000,
              currency: 'usd',
              recurring: { interval: 'month' },
            },
          },
        ],
      },
    }),
    list: jest.fn().mockResolvedValue({ data: [] }),
    update: jest.fn().mockResolvedValue({ id: 'sub_123', status: 'active' }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session',
      }),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        id: 'bps_123',
        url: 'https://billing.stripe.com/portal',
      }),
    },
  },
  invoices: {
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  webhooks: {
    constructEvent: jest.fn().mockReturnValue({
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: { object: {} },
      api_version: '2025-04-30',
      created: 1700000000,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      object: 'event',
    }),
  },
  products: {
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  prices: {
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'requires_payment_method',
      customer: null,
      payment_method: null,
      client_secret: 'pi_123_secret',
      next_action: null,
      last_payment_error: null,
      metadata: {},
      created: 1700000000,
    }),
    confirm: jest.fn().mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
      customer: 'cus_123',
      payment_method: 'pm_123',
      client_secret: 'pi_123_secret',
      next_action: null,
      last_payment_error: null,
      metadata: {},
      created: 1700000000,
    }),
    capture: jest.fn().mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
      customer: 'cus_123',
      payment_method: 'pm_123',
      client_secret: 'pi_123_secret',
      next_action: null,
      last_payment_error: null,
      metadata: {},
      created: 1700000000,
    }),
    cancel: jest.fn().mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'canceled',
      customer: 'cus_123',
      payment_method: null,
      client_secret: null,
      next_action: null,
      last_payment_error: null,
      metadata: {},
      created: 1700000000,
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
      customer: 'cus_123',
      payment_method: 'pm_123',
      client_secret: 'pi_123_secret',
      next_action: null,
      last_payment_error: null,
      metadata: {},
      created: 1700000000,
    }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({
      id: 'ref_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded',
      payment_intent: 'pi_123',
      reason: null,
      metadata: {},
      created: 1700000000,
    }),
    list: jest.fn().mockResolvedValue({ data: [] }),
    cancel: jest.fn().mockResolvedValue({
      id: 'ref_123',
      amount: 1000,
      currency: 'usd',
      status: 'canceled',
      payment_intent: 'pi_123',
      reason: null,
      metadata: {},
      created: 1700000000,
    }),
  },
  paymentMethods: {
    list: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'pm_123',
          customer: 'cus_123',
          type: 'card',
          created: 1700000000,
          billing_details: { name: 'Test', email: null, phone: null },
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2034,
            wallet: null,
          },
          ideal: null,
          sepa_debit: null,
          us_bank_account: null,
          metadata: {},
        },
      ],
    }),
    attach: jest.fn().mockResolvedValue({
      id: 'pm_123',
      customer: 'cus_123',
      type: 'card',
      created: 1700000000,
      billing_details: { name: 'Test', email: null, phone: null },
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2034,
        wallet: null,
      },
      ideal: null,
      sepa_debit: null,
      us_bank_account: null,
      metadata: {},
    }),
    detach: jest.fn().mockResolvedValue({
      id: 'pm_123',
      customer: null,
      type: 'card',
      created: 1700000000,
      billing_details: {},
      card: null,
      ideal: null,
      sepa_debit: null,
      us_bank_account: null,
      metadata: {},
    }),
  },
};

describe('StripeModule', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock', webhookSecret: 'whsec_mock' },
        },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should create a customer', async () => {
    const customer = await service.createCustomer({
      email: 'test@test.com',
      name: 'Test',
    });
    expect(customer.id).toBe('cus_123');
  });

  it('should create a subscription', async () => {
    const sub = await service.createSubscription({
      customerId: 'cus_123',
      priceId: 'price_1',
    });
    expect(sub.id).toBe('sub_123');
  });

  it('should get subscription', async () => {
    const sub = await service.getSubscription('sub_123');
    expect(sub.status).toBe('active');
    expect(sub.plan?.amount).toBe(1000);
  });

  it('should cancel subscription', async () => {
    const result = await service.cancelSubscription('sub_123');
    expect(result.status).toBe('canceled');
  });

  it('should create checkout session', async () => {
    const session = await service.createCheckoutSession({
      customerId: 'cus_123',
      priceId: 'price_1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(session.url).toContain('stripe.com');
  });

  it('should create billing portal session', async () => {
    const session = await service.createBillingPortalSession(
      'cus_123',
      'https://example.com',
    );
    expect(session.url).toContain('stripe.com');
  });

  it('should construct webhook event', () => {
    const event = service.constructWebhookEvent(
      JSON.stringify({ type: 'payment_intent.succeeded' }),
      'test_signature',
    );
    expect(event.type).toBe('payment_intent.succeeded');
  });

  it('should list subscriptions', async () => {
    const subs = await service.listSubscriptions('cus_123');
    expect(subs).toEqual([]);
  });
});

describe('StripeService — Payment Intents', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock', idempotencyTtlMs: 3600000 },
        },
        { provide: PaymentStore, useValue: mockStore },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should create a payment intent', async () => {
    const pi = await service.createPaymentIntent({
      amount: 1000,
      currency: 'usd',
      paymentMethodTypes: ['card'],
    });
    expect(pi.id).toBe('pi_123');
    expect(pi.amount).toBe(1000);
    expect(pi.status).toBe('requires_payment_method');
  });

  it('should create a payment intent with custom currency', async () => {
    const pi = await service.createPaymentIntent({
      amount: 5000,
      currency: 'eur',
    });
    expect(pi.currency).toBe('usd');
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'eur' }),
      expect.any(Object),
    );
  });

  it('should confirm a payment intent', async () => {
    const pi = await service.confirmPaymentIntent({
      paymentIntentId: 'pi_123',
      paymentMethodId: 'pm_123',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should capture a payment intent', async () => {
    const pi = await service.capturePaymentIntent({
      paymentIntentId: 'pi_123',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should cancel a payment intent', async () => {
    const pi = await service.cancelPaymentIntent('pi_123');
    expect(pi.status).toBe('canceled');
  });

  it('should retrieve a payment intent', async () => {
    const pi = await service.retrievePaymentIntent('pi_123');
    expect(pi.id).toBe('pi_123');
  });

  it('should list payment intents', async () => {
    const list = await service.listPaymentIntents('cus_123');
    expect(list).toEqual([]);
  });
});

describe('StripeService — Refunds', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock', idempotencyTtlMs: 3600000 },
        },
        { provide: PaymentStore, useValue: mockStore },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should create a full refund', async () => {
    const refund = await service.createRefund({ paymentIntentId: 'pi_123' });
    expect(refund.id).toBe('ref_123');
    expect(refund.status).toBe('succeeded');
  });

  it('should create a partial refund with reason', async () => {
    const refund = await service.createRefund({
      paymentIntentId: 'pi_123',
      amount: 500,
      reason: 'requested_by_customer',
    });
    expect(refund.amount).toBe(1000);
  });

  it('should list refunds', async () => {
    const refunds = await service.listRefunds('pi_123');
    expect(refunds).toEqual([]);
  });

  it('should cancel a refund', async () => {
    const refund = await service.cancelRefund('ref_123');
    expect(refund.status).toBe('canceled');
  });
});

describe('StripeService — Payment Methods', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock' },
        },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should list payment methods for customer', async () => {
    const methods = await service.listPaymentMethods('cus_123');
    expect(methods.length).toBe(1);
    expect(methods[0].type).toBe('card');
    expect(methods[0].card?.brand).toBe('visa');
  });

  it('should attach payment method to customer', async () => {
    const pm = await service.attachPaymentMethod({
      paymentMethodId: 'pm_123',
      customerId: 'cus_123',
    });
    expect(pm.customerId).toBe('cus_123');
  });

  it('should detach payment method from customer', async () => {
    const pm = await service.detachPaymentMethod('pm_123');
    expect(pm.id).toBe('pm_123');
  });
});

describe('StripeService — Subscriptions', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: STRIPE_CLIENT, useValue: mockStripe },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock' },
        },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should update a subscription', async () => {
    const sub = await service.updateSubscription('sub_123', {
      priceId: 'price_2',
    });
    expect(sub.id).toBe('sub_123');
  });
});

describe('StripeSandboxClient', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = new StripeSandboxClient();
  });

  it('should create a payment intent with requires_payment_method status', async () => {
    const pi = await sandbox.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
    });
    expect(pi.id).toMatch(/^pi_sandbox_\d+$/);
    expect(pi.amount).toBe(1000);
    expect(pi.status).toBe('requires_payment_method');
    expect(pi.client_secret).toContain('_secret_sandbox');
  });

  it('should succeed with VISA_SUCCESS card', async () => {
    const pi = await sandbox.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      payment_method: 'pm_4242424242424242',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should require 3DS with VISA_3DS card', async () => {
    const pi = await sandbox.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      payment_method: 'pm_4000002500003155',
    });
    expect(pi.status).toBe('requires_action');
    expect(pi.next_action.type).toBe('redirect_to_url');
  });

  it('should decline with GENERIC_DECLINE card', async () => {
    const pi = await sandbox.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      payment_method: 'pm_4000000000000002',
    });
    expect(pi.status).toBe('failed');
    expect(pi.last_payment_error.message).toContain('declined');
  });

  it('should confirm a payment intent and reflect card outcome', async () => {
    const pi = await sandbox.paymentIntents.confirm('pi_sandbox_1', {
      payment_method: 'pm_4242424242424242',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should capture a payment intent', async () => {
    const pi = await sandbox.paymentIntents.capture('pi_sandbox_1');
    expect(pi.status).toBe('succeeded');
  });

  it('should cancel a payment intent', async () => {
    const pi = await sandbox.paymentIntents.cancel('pi_sandbox_1');
    expect(pi.status).toBe('canceled');
  });

  it('should retrieve a payment intent', async () => {
    await sandbox.paymentIntents.create({ amount: 500, currency: 'usd' });
    const pi = await sandbox.paymentIntents.retrieve('pi_sandbox_1');
    expect(pi.amount).toBe(500);
  });

  it('should create and retrieve stateful payment intents on list', async () => {
    await sandbox.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      customer: 'cus_foo',
    });
    await sandbox.paymentIntents.create({
      amount: 200,
      currency: 'usd',
      customer: 'cus_foo',
    });
    const result = await sandbox.paymentIntents.list({ customer: 'cus_foo' });
    expect(result.data).toHaveLength(2);
  });

  it('should create a refund', async () => {
    const refund = await sandbox.refunds.create({
      payment_intent: 'pi_sandbox_1',
    });
    expect(refund.id).toMatch(/^re_sandbox_\d+$/);
    expect(refund.status).toBe('succeeded');
  });

  it('should list refunds', async () => {
    await sandbox.refunds.create({ payment_intent: 'pi_sandbox_1' });
    const result = await sandbox.refunds.list({
      payment_intent: 'pi_sandbox_1',
    });
    expect(result.data).toHaveLength(1);
  });

  it('should cancel a refund', async () => {
    const refund = await sandbox.refunds.cancel('re_sandbox_1');
    expect(refund.status).toBe('canceled');
  });

  it('should create and retrieve a customer', async () => {
    const customer = await sandbox.customers.create({ email: 'test@test.com' });
    expect(customer.id).toMatch(/^cus_sandbox_\d+$/);
    expect(customer.email).toBe('test@test.com');
    const retrieved = await sandbox.customers.retrieve(customer.id);
    expect(retrieved.id).toBe(customer.id);
  });

  it('should attach and detach payment methods', async () => {
    const attached = await sandbox.paymentMethods.attach('pm_test', {
      customer: 'cus_sandbox_1',
    });
    expect(attached.customer).toBe('cus_sandbox_1');
    const detached = await sandbox.paymentMethods.detach('pm_test');
    expect(detached.customer).toBeNull();
  });

  it('should create a subscription', async () => {
    const sub = await sandbox.subscriptions.create({
      customer: 'cus_sandbox_1',
      items: [{ price: 'price_test' }],
    });
    expect(sub.id).toMatch(/^sub_sandbox_\d+$/);
    expect(sub.status).toBe('active');
  });

  it('should create a checkout session', async () => {
    const session = await sandbox.checkout.sessions.create({
      customer: 'cus_sandbox_1',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    });
    expect(session.url).toContain('checkout.stripe.com');
  });

  it('should create a billing portal session', async () => {
    const session = await sandbox.billingPortal.sessions.create({
      customer: 'cus_sandbox_1',
      return_url: 'https://example.com',
    });
    expect(session.url).toContain('billing.stripe.com');
  });

  it('should construct a webhook event', () => {
    const event = sandbox.webhooks.constructEvent(
      Buffer.from('{}'),
      'sig',
      'secret',
    );
    expect(event.type).toBe('payment_intent.succeeded');
    expect(event.id).toMatch(/^evt_sandbox_/);
  });

  it('should list products', async () => {
    const result = await sandbox.products.list();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Default Sandbox Product');
  });

  it('should list prices', async () => {
    const result = await sandbox.prices.list();
    expect(result.data).toHaveLength(2);
  });

  it('should list invoices', async () => {
    const result = await sandbox.invoices.list({ customer: 'cus_sandbox_1' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].number).toBe('SANDBOX-0001');
  });
});

describe('StripeService with SandboxClient', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: STRIPE_CLIENT,
          useFactory: () => new StripeSandboxClient(),
        },
        {
          provide: STRIPE_MODULE_OPTIONS,
          useValue: { apiKey: 'sk_test_mock', sandbox: true },
        },
        StripeService,
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should create payment intent via sandbox', async () => {
    const pi = await service.createPaymentIntent({
      amount: 1000,
      currency: 'usd',
    });
    expect(pi.id).toMatch(/^pi_sandbox_\d+$/);
    expect(pi.status).toBe('requires_payment_method');
  });

  it('should confirm payment intent via sandbox', async () => {
    const pi = await service.confirmPaymentIntent({
      paymentIntentId: 'pi_sandbox_test',
      paymentMethodId: 'pm_4242424242424242',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should capture payment intent via sandbox', async () => {
    const pi = await service.capturePaymentIntent({
      paymentIntentId: 'pi_sandbox_test',
    });
    expect(pi.status).toBe('succeeded');
  });

  it('should create customer via sandbox', async () => {
    const customer = await service.createCustomer({ email: 'sand@test.com' });
    expect(customer.id).toMatch(/^cus_sandbox_\d+$/);
  });

  it('should create subscription via sandbox', async () => {
    const sub = await service.createSubscription({
      customerId: 'cus_sandbox_test',
      priceId: 'price_sandbox_default_monthly',
    });
    expect(sub.id).toMatch(/^sub_sandbox_\d+$/);
    expect(sub.status).toBe('active');
  });

  it('should list subscriptions via sandbox', async () => {
    const subs = await service.listSubscriptions('cus_sandbox_test');
    expect(subs).toEqual([]);
  });

  it('should create checkout session via sandbox', async () => {
    const session = await service.createCheckoutSession({
      customerId: 'cus_sandbox_test',
      priceId: 'price_sandbox_default_monthly',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(session.url).toContain('checkout.stripe.com');
  });

  it('should create refund via sandbox', async () => {
    const refund = await service.createRefund({
      paymentIntentId: 'pi_sandbox_test',
    });
    expect(refund.status).toBe('succeeded');
  });

  it('should construct webhook event via sandbox', () => {
    const event = service.constructWebhookEvent(Buffer.from('{}'), 'test_sig');
    expect(event.type).toBe('payment_intent.succeeded');
  });

  it('should list products via sandbox', async () => {
    const products = await service.listProducts();
    expect(products).toHaveLength(1);
  });

  it('should list prices via sandbox', async () => {
    const prices = await service.listPrices();
    expect(prices).toHaveLength(2);
  });

  it('should list invoices via sandbox', async () => {
    const invoices = await service.getInvoices('cus_sandbox_test');
    expect(invoices).toHaveLength(1);
    expect(invoices[0].number).toBe('SANDBOX-0001');
  });
});
