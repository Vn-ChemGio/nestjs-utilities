import type { Type } from '@nestjs/common';

export interface StripeModuleOptions {
  apiKey: string;
  webhookSecret?: string;
  defaultCurrency?: string;
  defaultTaxRate?: number;
  metadata?: Record<string, string>;
  idempotencyTtlMs?: number;
  store?: Type<PaymentStore>;
  sandbox?: boolean;
}

export abstract class PaymentStore {
  abstract saveTransaction(tx: PaymentTransaction): Promise<void>;
  abstract updateTransaction(
    paymentIntentId: string,
    update: Partial<PaymentTransaction>,
  ): Promise<void>;
  abstract getTransaction(
    paymentIntentId: string,
  ): Promise<PaymentTransaction | undefined>;
  abstract saveRefund(refund: RefundRecord): Promise<void>;
  abstract updateRefund(
    refundId: string,
    update: Partial<RefundRecord>,
  ): Promise<void>;
  abstract getRefund(refundId: string): Promise<RefundRecord | undefined>;
  abstract listRefunds(paymentIntentId?: string): Promise<RefundRecord[]>;
  abstract acquireLock(key: string, ttlMs: number): Promise<boolean>;
  abstract releaseLock(key: string): Promise<void>;
}

export interface PaymentTransaction {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  error?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecord {
  id: string;
  refundId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export type PaymentMethodType =
  | 'acss_debit'
  | 'affirm'
  | 'afterpay_clearpay'
  | 'alipay'
  | 'alma'
  | 'amazon_pay'
  | 'au_becs_debit'
  | 'bacs_debit'
  | 'bancontact'
  | 'billie'
  | 'bizum'
  | 'blik'
  | 'boleto'
  | 'card'
  | 'cashapp'
  | 'crypto'
  | 'customer_balance'
  | 'eps'
  | 'fpx'
  | 'giropay'
  | 'grabpay'
  | 'ideal'
  | 'kakao_pay'
  | 'klarna'
  | 'konbini'
  | 'kr_card'
  | 'link'
  | 'mb_way'
  | 'mobilepay'
  | 'multibanco'
  | 'naver_pay'
  | 'nz_bank_account'
  | 'oxxo'
  | 'p24'
  | 'pay_by_bank'
  | 'payco'
  | 'paynow'
  | 'paypal'
  | 'payto'
  | 'pix'
  | 'promptpay'
  | 'revolut_pay'
  | 'samsung_pay'
  | 'satispay'
  | 'scalapay'
  | 'sepa_debit'
  | 'sofort'
  | 'sunbit'
  | 'swish'
  | 'twint'
  | 'upi'
  | 'us_bank_account'
  | 'wechat_pay'
  | 'zip';

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  paymentMethodTypes?: PaymentMethodType[];
  description?: string;
  metadata?: Record<string, string>;
  confirm?: boolean;
  captureMethod?: 'automatic' | 'manual';
  returnUrl?: string;
  offSession?: boolean;
  idempotencyKey?: string;
}

export interface ConfirmPaymentIntentInput {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
  idempotencyKey?: string;
}

export interface CapturePaymentIntentInput {
  paymentIntentId: string;
  amountToCapture?: number;
  idempotencyKey?: string;
}

export interface CreateRefundInput {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface AttachPaymentMethodInput {
  paymentMethodId: string;
  customerId: string;
}

export interface CreateCustomerInput {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionInput {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
  paymentBehavior?:
    | 'default_incomplete'
    | 'pending_if_incomplete'
    | 'error_if_incomplete';
}

export interface CreateCheckoutInput {
  customerId: string;
  priceId?: string;
  mode?: 'subscription' | 'payment' | 'setup';
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
  allowPromotionCodes?: boolean;
  lineItems?: { price: string; quantity: number }[];
  currency?: string;
  paymentMethodTypes?: PaymentMethodType[];
}

export interface SubscriptionStatus {
  id: string;
  customerId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  plan?: {
    id: string;
    product: string;
    amount: number;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
  };
}

export interface InvoiceResult {
  id: string;
  number: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string;
  pdfUrl?: string;
  paidAt?: Date;
  lines: { description: string; amount: number; quantity: number }[];
}

export interface PaymentMethodResult {
  id: string;
  customerId?: string;
  type: string;
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  wallet?: { type: string };
  ideal?: { bank: string };
  sepaDebit?: { last4: string; bankCode: string };
  usBankAccount?: { bankName: string; last4: string };
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface PaymentIntentResult {
  id: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  customerId?: string;
  paymentMethodId?: string;
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  lastPaymentError?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface RefundResult {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export type StripeWebhookHandler = (event: unknown) => void | Promise<void>;

export const PAYMENT_INTENT_FINAL_STATUSES: PaymentIntentStatus[] = [
  'succeeded',
  'failed',
  'canceled',
];

export const VALID_TRANSITIONS: Record<
  PaymentIntentStatus,
  PaymentIntentStatus[]
> = {
  requires_payment_method: [
    'requires_confirmation',
    'requires_action',
    'processing',
    'canceled',
  ],
  requires_confirmation: [
    'requires_action',
    'processing',
    'succeeded',
    'failed',
    'canceled',
  ],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled'],
  processing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  canceled: [],
};
