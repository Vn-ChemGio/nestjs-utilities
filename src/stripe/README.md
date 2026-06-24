# nesthub/stripe

Stripe payment processing module for NestJS — payment intents, refunds, payment methods, customers, subscriptions, checkout, webhooks, and products/prices.

## Features

- **Payment Intents** — create, confirm, capture, cancel, retrieve, list
- **Refunds** — full and partial refunds, list, cancel
- **Payment Methods** — list, attach, detach (56+ payment method types supported)
- **Customers** — create, retrieve
- **Subscriptions** — create, update, cancel, retrieve, list
- **Checkout Sessions** — create hosted checkout pages
- **Billing Portal** — create Stripe Customer Portal sessions
- **Webhooks** — construct and dispatch typed events
- **Products & Prices** — list products and prices
- **Multi‑currency** — per‑request currency override
- **Idempotency** — auto‑generated idempotency keys with configurable TTL
- **ACID Transaction Store** — optional `PaymentStore` abstract class for persisting payment lifecycle to a database
- **State Machine** — `VALID_TRANSITIONS` map enforces legal payment intent status transitions when store is active

## Installation

```bash
npm install nesthub
```

**Peer dependency:**

```bash
npm install stripe
```

The Stripe SDK is loaded via dynamic `import()` so it's only resolved when the module is registered. Type definitions ship with the `stripe` package.

---

## Module registration

```typescript
import { Module } from '@nestjs/common';
import { StripeModule } from 'nesthub/stripe';

@Module({
  imports: [StripeModule.forRoot({ apiKey: process.env.STRIPE_SECRET_KEY! })],
})
export class AppModule {}
```

`forRoot` is synchronous. Pass your Stripe secret key and optional configuration.

---

## Configuration

```typescript
interface StripeModuleOptions {
  apiKey: string; // Your Stripe secret key (required)
  webhookSecret?: string; // Signing secret for webhook verification
  defaultCurrency?: string; // 'usd' — fallback when no currency is specified
  defaultTaxRate?: number;
  metadata?: Record<string, string>; // Static metadata merged into every Stripe object
  idempotencyTtlMs?: number; // Auto-generated idempotency key TTL in ms
  store?: Type<PaymentStore>; // Custom ACID store implementation
  webhookHandlers?: StripeWebhookHandler[]; // Event handlers for incoming webhooks
}
```

---

## Payment Lifecycle & Flows

### Payment Intent State Machine

```
                         ┌──────────────────────────────────┐
                         │   requires_payment_method         │
                         │   (initial state)                 │
                         └──────────┬───────────────────────┘
                                    │
                       ┌────────────┼────────────┐
                       ▼            ▼            ▼
              ┌──────────────┐ ┌──────────┐ ┌────────┐
              │  canceled    │ │requires_ │ │requires│
              │              │ │confirmatn│ │_action │
              └──────────────┘ └─────┬────┘ └───┬────┘
                       │            │          │
                       │     ┌──────┘          │
                       │     ▼                 ▼
                       │  ┌──────────┐ ┌──────────┐
                       │  │ succeeded│ │processing│
                       │  │          │ └─────┬────┘
                       │  └──────────┘       │
                       │              ┌──────┘
                       ▼              ▼
                  ┌──────────┐  ┌──────────┐
                  │  failed  │  │succeeded │
                  └──────────┘  └──────────┘
```

**Explanation:** A Payment Intent starts in `requires_payment_method` and can move through confirmation and processing before reaching a terminal state (`succeeded`, `failed`, or `canceled`). Once terminal, no further transitions are allowed.

### Standard One-Time Payment Flow

```
Client                    Your Server                 Stripe
  │                           │                        │
  │  1. Request payment       │                        │
  │──────────────────────────►│                        │
  │                           │  2. createPaymentIntent│
  │                           │───────────────────────►│
  │                           │◄───────────────────────│
  │  3. Return client_secret  │                        │
  │◄──────────────────────────│                        │
  │                           │                        │
  │  4. Confirm in frontend   │                        │
  │  (Stripe.js / Elements)   │                        │
  │──────────────────────────────────────────────────►│
  │                           │                        │
  │  5. Webhook:              │                        │
  │  payment_intent.succeeded │                        │
  │◄──────────────────────────────────────────────────│
  │                           │                        │
```

### Two-Phase (Manual Capture) Flow

```
Client                    Your Server                 Stripe
  │                           │                        │
  │  1. Authorize payment     │                        │
  │──────────────────────────►│                        │
  │                           │  2. createPaymentIntent │
  │                           │     (captureMethod:    │
  │                           │      'manual')         │
  │                           │───────────────────────►│
  │                           │◄───────────────────────│
  │◄──────────────────────────│                        │
  │                           │                        │
  │  3. Ship goods            │                        │
  │  4. Capture after fulfill │                        │
  │──────────────────────────►│                        │
  │                           │  5. capturePaymentIntent│
  │                           │───────────────────────►│
  │                           │◄───────────────────────│
  │◄──────────────────────────│                        │
```

---

## Service Methods vs Controller Endpoints

Every service method has a corresponding REST endpoint in the auto‑registered `StripeController`. Use the **service** when calling from another NestJS provider (same process), or the **controller** when integrating from external clients.

| Operation               | Service Method                                      | HTTP Endpoint                                |
| ----------------------- | --------------------------------------------------- | -------------------------------------------- |
| Create payment intent   | `createPaymentIntent(input)`                        | `POST /stripe/payment-intents`               |
| Confirm payment intent  | `confirmPaymentIntent(input)`                       | `POST /stripe/payment-intents/:id/confirm`   |
| Capture payment intent  | `capturePaymentIntent(input)`                       | `POST /stripe/payment-intents/:id/capture`   |
| Cancel payment intent   | `cancelPaymentIntent(id, reason?)`                  | `POST /stripe/payment-intents/:id/cancel`    |
| Retrieve payment intent | `retrievePaymentIntent(id)`                         | `GET /stripe/payment-intents/:id`            |
| List payment intents    | `listPaymentIntents(customerId, limit?)`            | `GET /stripe/payment-intents?customerId=...` |
| Create refund           | `createRefund(input)`                               | `POST /stripe/refunds`                       |
| List refunds            | `listRefunds(paymentIntentId?)`                     | `GET /stripe/refunds?paymentIntentId=...`    |
| Cancel refund           | `cancelRefund(id)`                                  | `POST /stripe/refunds/:id/cancel`            |
| List payment methods    | `listPaymentMethods(customerId, type?)`             | `GET /stripe/customers/:id/payment-methods`  |
| Attach payment method   | `attachPaymentMethod(input)`                        | `POST /stripe/payment-methods/:id/attach`    |
| Detach payment method   | `detachPaymentMethod(id)`                           | `POST /stripe/payment-methods/:id/detach`    |
| Create customer         | `createCustomer(input)`                             | `POST /stripe/customers`                     |
| Get customer            | `getCustomer(id)`                                   | `GET /stripe/customers/:id`                  |
| Create subscription     | `createSubscription(input)`                         | `POST /stripe/subscriptions`                 |
| Get subscription        | `getSubscription(id)`                               | `GET /stripe/subscriptions/:id`              |
| Cancel subscription     | `cancelSubscription(id)`                            | `POST /stripe/subscriptions/:id/cancel`      |
| Update subscription     | `updateSubscription(id, updates)`                   | `PATCH /stripe/subscriptions/:id`            |
| Create checkout session | `createCheckoutSession(input)`                      | `POST /stripe/checkout`                      |
| Billing portal session  | `createBillingPortalSession(customerId, returnUrl)` | `POST /stripe/billing-portal`                |
| List products           | `listProducts()`                                    | `GET /stripe/products`                       |
| List prices             | `listPrices(productId?)`                            | `GET /stripe/prices`                         |
| Webhook receiver        | `constructWebhookEvent(payload, signature)`         | `POST /stripe/webhook`                       |

---

## Scenario-Based Usage

### Scenario 1: One-Time Card Payment (Automatic Capture)

**Flow:** Create intent → client confirms in browser → webhook notifies success.

**Service usage (backend):**

```typescript
import { Injectable } from '@nestjs/common';
import { StripeService } from 'nesthub/stripe';

@Injectable()
export class CheckoutService {
  constructor(private readonly stripe: StripeService) {}

  async initiatePayment(order: {
    id: string;
    amount: number;
    currency: string;
  }) {
    const intent = await this.stripe.createPaymentIntent({
      amount: order.amount, // in cents: $10.00 → 1000
      currency: order.currency,
      paymentMethodTypes: ['card'],
      metadata: { orderId: order.id },
      captureMethod: 'automatic', // default — charge immediately on confirm
    });

    return {
      clientSecret: intent.clientSecret, // send to frontend
      paymentIntentId: intent.id,
    };
  }
}
```

**Controller usage (via curl):**

```bash
curl -X POST http://localhost:3000/stripe/payment-intents \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "usd",
    "paymentMethodTypes": ["card"]
  }'
```

**Frontend confirmation (Stripe.js):**

```javascript
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: paymentMethodId,
});

if (error) {
  // Handle payment failure → see Error Handling section
} else if (paymentIntent.status === 'succeeded') {
  // Payment complete
}
```

**Webhook handler for fulfillment:**

```typescript
StripeModule.forRoot({
  apiKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  webhookHandlers: [
    {
      event: 'payment_intent.succeeded',
      handler: async (event) => {
        const pi = event.data.object;
        // Fulfill order, update database, send email, etc.
      },
    },
    {
      event: 'payment_intent.payment_failed',
      handler: async (event) => {
        const pi = event.data.object;
        // Notify customer, retry or offer alternative method
      },
    },
  ],
});
```

---

### Scenario 2: Manual Capture (Authorize Only, Capture Later)

**Use case:** E‑commerce where you authorize when the order is placed and capture only when the item ships.

```typescript
// Step 1 — Authorize (hold funds)
const intent = await this.stripe.createPaymentIntent({
  amount: 5000,
  currency: 'usd',
  captureMethod: 'manual', // ← key: do NOT charge yet
});

// Step 2 — Confirm payment method (client-side with Stripe.js)
await this.stripe.confirmPaymentIntent({
  paymentIntentId: intent.id,
  paymentMethodId: 'pm_xxx',
});

// Step 3 — Later, after fulfillment
const captured = await this.stripe.capturePaymentIntent({
  paymentIntentId: intent.id,
  amountToCapture: 5000, // optional: capture partial amount
});
```

**Via controller:**

```bash
# Authorize
curl -X POST http://localhost:3000/stripe/payment-intents \
  -d '{"amount":5000,"currency":"usd","captureMethod":"manual"}'

# Capture
curl -X POST http://localhost:3000/stripe/payment-intents/pi_xxx/capture \
  -d '{"amountToCapture":5000}'

# Cancel authorization (release hold)
curl -X POST http://localhost:3000/stripe/payment-intents/pi_xxx/cancel
```

---

### Scenario 3: Save Card & Charge Later

**Use case:** Attach a payment method to a customer, then create intents using that saved method.

```typescript
// Step 1 — Create customer
const customer = await this.stripe.createCustomer({
  email: 'user@example.com',
  name: 'Alice',
});

// Step 2 — Attach payment method (run after frontend collects card)
await this.stripe.attachPaymentMethod({
  paymentMethodId: 'pm_xxx',
  customerId: customer.id,
});

// Step 3 — Charge using saved payment method
const intent = await this.stripe.createPaymentIntent({
  amount: 2000,
  currency: 'usd',
  customerId: customer.id,
  paymentMethodId: 'pm_xxx',
  confirm: true, // confirm immediately on the server
  offSession: true, // allow charging without customer present
});
```

---

### Scenario 4: Subscriptions

**Use case:** Recurring billing — create subscription, manage lifecycle.

```typescript
// Create a subscription with trial
const sub = await this.stripe.createSubscription({
  customerId: 'cus_xxx',
  priceId: 'price_monthly',
  trialDays: 14,
  paymentBehavior: 'default_incomplete',
});

// Upgrade plan
const updated = await this.stripe.updateSubscription('sub_xxx', {
  priceId: 'price_premium',
});

// Cancel at period end (no proration)
await this.stripe.cancelSubscription('sub_xxx');
// To cancel immediately, use Stripe's API directly via the client:
// this.stripe.subscriptions.cancel('sub_xxx', { invoice_now: true, prorate: true });
```

**Webhook events for subscription lifecycle:**

```typescript
webhookHandlers: [
  { event: 'customer.subscription.created', handler: ... },
  { event: 'customer.subscription.updated', handler: ... },
  { event: 'customer.subscription.deleted', handler: ... },
  { event: 'invoice.payment_succeeded', handler: ... },
  { event: 'invoice.payment_failed', handler: ... },   // ← dunning handling
]
```

---

### Scenario 5: Checkout Session (Hosted Payment Page)

**Use case:** Redirect customers to Stripe's hosted checkout page — no frontend Stripe.js needed.

```typescript
const session = await this.stripe.createCheckoutSession({
  customerId: 'cus_xxx',
  priceId: 'price_xxx',
  mode: 'payment', // or 'subscription' or 'setup'
  successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://example.com/cart',
  allowPromotionCodes: true,
  paymentMethodTypes: ['card', 'ideal', 'klarna'],
});

// Redirect the customer
return { url: session.url };
```

**Via controller:**

```bash
curl -X POST http://localhost:3000/stripe/checkout \
  -d '{
    "customerId":"cus_xxx",
    "priceId":"price_xxx",
    "mode":"payment",
    "successUrl":"https://example.com/success",
    "cancelUrl":"https://example.com/cancel"
  }'
```

**Webhook for post‑checkout:**

```typescript
webhookHandlers: [
  {
    event: 'checkout.session.completed',
    handler: async (event) => {
      const session = event.data.object;
      // Grant access, provision account, etc.
    },
  },
  {
    event: 'checkout.session.expired',
    handler: async (event) => {
      // Session expired without payment — clean up
    },
  },
];
```

---

### Scenario 6: Refunds

**Use case:** Full or partial refund after payment.

```typescript
// Full refund
const refund = await this.stripe.createRefund({
  paymentIntentId: 'pi_xxx',
});

// Partial refund with reason
const partial = await this.stripe.createRefund({
  paymentIntentId: 'pi_xxx',
  amount: 1000, // refund only $10.00 of a $20.00 charge
  reason: 'requested_by_customer',
  metadata: { ticketId: 'TKT-123' },
});

// Cancel a pending refund (only if status is 'pending')
await this.stripe.cancelRefund('ref_xxx');
```

**Via controller:**

```bash
# Full refund
curl -X POST http://localhost:3000/stripe/refunds \
  -d '{"paymentIntentId":"pi_xxx"}'

# Partial refund
curl -X POST http://localhost:3000/stripe/refunds \
  -d '{"paymentIntentId":"pi_xxx","amount":1000,"reason":"requested_by_customer"}'

# List refunds
curl http://localhost:3000/stripe/refunds?paymentIntentId=pi_xxx

# Cancel refund
curl -X POST http://localhost:3000/stripe/refunds/ref_xxx/cancel
```

---

### Scenario 7: Customer Portal

**Use case:** Let customers manage their own subscription, payment methods, and invoices.

```typescript
const portal = await this.stripe.createBillingPortalSession(
  'cus_xxx',
  'https://example.com/account',
);

return { url: portal.url }; // Redirect customer here
```

---

## Error Handling

### Common Payment Errors & How to Handle Them

| Error                     | Scenario                                | Recovery Strategy                                                                                                                    |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `card_declined`           | Card was declined during payment        | Ask customer to use a different card. Check `decline_code` for specifics (`insufficient_funds`, `stolen_card`, etc.).                |
| `expired_card`            | Card has expired                        | Prompt customer to update card details.                                                                                              |
| `processing_error`        | Temporary Stripe/network error          | Retry with idempotency key (safe to retry).                                                                                          |
| `incorrect_cvc`           | Wrong CVC code                          | Let customer re-enter the CVC.                                                                                                       |
| `requires_action`         | 3D Secure authentication needed         | Return `nextAction.redirectUrl` to frontend so customer can authenticate.                                                            |
| `insufficient_funds`      | Not enough balance                      | Try a different payment method or reduce amount.                                                                                     |
| `invalid_transition`      | State machine violation (store enabled) | Payment already reached a terminal state — do not retry. Fetch the intent via `retrievePaymentIntent(id)` to see the current status. |
| `authentication_required` | SCA / Strong Customer Auth required     | Confirm with `paymentMethodId` and `returnUrl`.                                                                                      |

### Handling Failed Payments in Service Code

```typescript
@Injectable()
export class PaymentService {
  constructor(private readonly stripe: StripeService) {}

  async processPayment(order: Order) {
    try {
      const intent = await this.stripe.createPaymentIntent({
        amount: order.total,
        currency: 'usd',
        paymentMethodTypes: ['card'],
      });

      return { clientSecret: intent.clientSecret };
    } catch (error) {
      // Stripe errors contain a `type` and `code`
      if (error.type === 'StripeCardError') {
        // Card-specific failure
        this.logger.warn(`Card declined: ${error.code}`);
        throw new PaymentDeclinedException(error.code);
      }

      if (error.type === 'StripeRateLimitError') {
        // Too many requests — retry with backoff
        throw new RetryableException();
      }

      if (error.type === 'StripeInvalidRequestError') {
        // Bad parameters — fix and re-submit
        throw new BadRequestException(error.message);
      }

      if (
        error.type === 'StripeAPIError' ||
        error.type === 'StripeConnectionError'
      ) {
        // Temporary Stripe outage — retry later
        throw new RetryableException();
      }

      // Unexpected
      throw error;
    }
  }
}
```

### Handling 3D Secure (SCA) Authentication

When a payment requires authentication, the API returns `status: 'requires_action'` and the response includes `nextAction`:

```typescript
const intent = await this.stripe.createPaymentIntent({ ... });

if (intent.status === 'requires_action' && intent.nextAction?.redirectUrl) {
  // Send this URL to the frontend for 3D Secure redirect
  return {
    requiresAction: true,
    redirectUrl: intent.nextAction.redirectUrl,
    paymentIntentId: intent.id,
  };
}

// Payment succeeded without authentication
return { success: true, paymentIntentId: intent.id };
```

### Webhook Reconciliation Failures

When processing webhooks, you may encounter:

```typescript
webhookHandlers: [
  {
    event: 'payment_intent.succeeded',
    handler: async (event) => {
      const pi = event.data.object;

      // ❌ Common issue: Webhook arrives before your database has the record
      // ✅ Solution: Use the PaymentStore to track intent status transitions.
      //    If the store shows 'succeeded' already, skip processing (idempotent).
    },
  },
  {
    event: 'payment_intent.payment_failed',
    handler: async (event) => {
      const pi = event.data.object;

      // Check last_payment_error for details
      const error = pi.last_payment_error;
      if (error?.code === 'card_declined') {
        // Notify customer to retry with a different payment method
      }
    },
  },
];
```

### Duplicate Webhook Prevention

Stripe may send the same event more than once. Use the `PaymentStore.acquireLock` mechanism:

```typescript
// Inside your webhook handler
const lockAcquired = await paymentStore.acquireLock(eventId, 60000);
if (!lockAcquired) {
  // Already processing this event — skip
  return;
}
try {
  // Process event
} finally {
  await paymentStore.releaseLock(eventId);
}
```

---

## ACID Transaction Store

The optional `PaymentStore` abstract class provides ACID guarantees for payment lifecycle tracking. Implement it with any database (TypeORM, Prisma, MongoDB, etc.).

```typescript
import { Injectable } from '@nestjs/common';
import { PaymentStore, PaymentTransaction, RefundRecord } from 'nesthub/stripe';

@Injectable()
export class MyPaymentStore extends PaymentStore {
  async saveTransaction(tx: PaymentTransaction): Promise<void> {
    /* … */
  }
  async updateTransaction(
    id: string,
    update: Partial<PaymentTransaction>,
  ): Promise<void> {
    /* … */
  }
  async getTransaction(id: string): Promise<PaymentTransaction | undefined> {
    /* … */
  }
  async saveRefund(refund: RefundRecord): Promise<void> {
    /* … */
  }
  async updateRefund(id: string, update: Partial<RefundRecord>): Promise<void> {
    /* … */
  }
  async getRefund(id: string): Promise<RefundRecord | undefined> {
    /* … */
  }
  async listRefunds(paymentIntentId?: string): Promise<RefundRecord[]> {
    /* … */
  }
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    /* … */
  }
  async releaseLock(key: string): Promise<void> {
    /* … */
  }
}
```

Register it:

```typescript
StripeModule.forRoot({
  apiKey: process.env.STRIPE_SECRET_KEY!,
  store: MyPaymentStore,
});
```

When a store is configured, every mutation (create, confirm, capture, cancel payment intent; create, cancel refund) is recorded.

### How the Store Prevents Payment Errors

1. **Duplicate detection via idempotency keys:** Each mutation generates a unique `nesthub_<op>_<id>` key. Stripe ignores retries with the same key.
2. **Invalid transition rejection:** The `validateTransition` method checks `VALID_TRANSITIONS` before every mutation. For example, you cannot `capture` an already-`canceled` intent.
3. **Distributed lock for webhooks:** `acquireLock` / `releaseLock` prevents concurrent processing of the same Stripe event across multiple server instances.

### Payment Store Data Model

The store tracks two record types:

**PaymentTransaction** — created on `createPaymentIntent`, updated on confirm/capture/cancel:

| Field              | Type                     | Description                    |
| ------------------ | ------------------------ | ------------------------------ |
| `id`               | `string`                 | Payment intent ID              |
| `paymentIntentId`  | `string`                 | Same as `id`                   |
| `amount`           | `number`                 | Amount in cents                |
| `currency`         | `string`                 | Lowercase currency code        |
| `status`           | `PaymentIntentStatus`    | Current status from Stripe     |
| `customerId?`      | `string`                 | Stripe customer ID             |
| `paymentMethodId?` | `string`                 | Stripe payment method ID       |
| `description?`     | `string`                 | Transaction description        |
| `metadata?`        | `Record<string, string>` | Custom metadata                |
| `error?`           | `string`                 | Last error message from Stripe |
| `idempotencyKey?`  | `string`                 | Idempotency key used           |
| `createdAt`        | `string`                 | ISO 8601 timestamp             |
| `updatedAt`        | `string`                 | ISO 8601 timestamp             |

**RefundRecord** — created on `createRefund`, updated on `cancelRefund`:

| Field             | Type                     | Description                                          |
| ----------------- | ------------------------ | ---------------------------------------------------- |
| `id`              | `string`                 | Refund ID                                            |
| `refundId`        | `string`                 | Same as `id`                                         |
| `paymentIntentId` | `string`                 | Original payment intent                              |
| `amount`          | `number`                 | Amount refunded in cents                             |
| `currency`        | `string`                 | Lowercase currency code                              |
| `status`          | `RefundStatus`           | `'pending'`, `'succeeded'`, `'failed'`, `'canceled'` |
| `reason?`         | `string`                 | Reason for refund                                    |
| `metadata?`       | `Record<string, string>` | Custom metadata                                      |
| `createdAt`       | `string`                 | ISO 8601 timestamp                                   |
| `updatedAt`       | `string`                 | ISO 8601 timestamp                                   |

---

## State Machine

```typescript
const VALID_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
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
  succeeded: [], // terminal — no outgoing transitions
  failed: [], // terminal
  canceled: [], // terminal
};
```

Enforced only when a `PaymentStore` is configured. Without a store, any status returned by Stripe is accepted.

When the store is active and an invalid transition is attempted, the service throws:

```
Error: Invalid payment status transition: requires_payment_method → succeeded
```

---

## Multi‑currency

Pass `currency` on every payment intent and checkout call. The `defaultCurrency` option serves as fallback when no currency is specified:

```typescript
await this.stripe.createPaymentIntent({ amount: 1000, currency: 'eur' });
await this.stripe.createCheckoutSession({
  customerId: 'cus_xxx',
  priceId: 'price_xxx',
  currency: 'jpy',
  successUrl: '…',
  cancelUrl: '…',
});
```

---

## Idempotency

When `idempotencyTtlMs` is set in options, every mutation operation generates an idempotency key (`nesthub_<operation>_<id>`) automatically. You can also pass your own key per‑request:

```typescript
await this.stripe.createPaymentIntent({
  amount: 1000,
  currency: 'usd',
  idempotencyKey: 'my-custom-key',
});
```

This is critical for safely retrying failed API calls — if Stripe already processed the request, it returns the same result instead of creating a duplicate charge.

---

---

## Sandbox Mode

When `sandbox: true` is passed to `StripeModule.forRoot()`, the module provides `StripeSandboxClient` instead of the real Stripe SDK. No API calls are made — all responses are deterministic mock data, perfect for development, CI, and integration tests.

### Usage

```typescript
@Module({
  imports: [
    StripeModule.forRoot({
      apiKey: 'sk_test_...', // still required, but won't be used
      sandbox: true,
    }),
  ],
})
export class AppModule {}
```

All `StripeService` methods work identically — the sandbox client is transparent.

### Test Card Numbers

The sandbox client respects Stripe's test card numbers to simulate different payment outcomes. Pass the card number as (part of) the `paymentMethodId`:

| Card Number        | Outcome                                |
| ------------------ | -------------------------------------- |
| `4242424242424242` | Success (default)                      |
| `4000002500003155` | 3D Secure required (`requires_action`) |
| `4000000000000002` | Generic decline                        |
| `4000000000009995` | Insufficient funds                     |
| `4000000000004954` | Lost/stolen card                       |
| `4000000000000069` | Expired card                           |
| `4000000000000127` | Incorrect CVC                          |
| `4000000000000119` | Processing error                       |

Example — simulating a declined card:

```typescript
const intent = await stripeService.confirmPaymentIntent({
  paymentIntentId: 'pi_xxx',
  paymentMethodId: 'pm_4000000000000002',
});
// intent.status === 'failed'
// intent.lastPaymentError === 'Your card was declined.'
```

### Available Sandbox Constants

```typescript
import { SANDBOX_TEST_CARDS, StripeSandboxClient } from 'nesthub/stripe';

// Reference test cards by name
SANDBOX_TEST_CARDS.VISA_SUCCESS; // '4242424242424242'
SANDBOX_TEST_CARDS.VISA_3DS; // '4000002500003155'
SANDBOX_TEST_CARDS.GENERIC_DECLINE; // '4000000000000002'
SANDBOX_TEST_CARDS.INSUFFICIENT_FUNDS; // '4000000000009995'
SANDBOX_TEST_CARDS.STOLEN_CARD; // '4000000000004954'
SANDBOX_TEST_CARDS.EXPIRED_CARD; // '4000000000000069'
SANDBOX_TEST_CARDS.INCORRECT_CVC; // '4000000000000127'
SANDBOX_TEST_CARDS.PROCESSING_ERROR; // '4000000000000119'
```

### Sandbox In-Memory State

The sandbox client maintains in-memory state for objects created during the session:

- Created payment intents are stored and returned by `retrieve` / `list`
- Refunds, customers, subscriptions, and payment methods are similarly tracked
- Each object gets a deterministic ID (`pi_sandbox_1`, `cus_sandbox_1`, etc.)
- State is **not** shared across `forRoot()` calls — each module instance gets a fresh sandbox

### Using StripeService Directly with SandboxClient

You can also inject `StripeSandboxClient` directly for full Stripe SDK mock access:

```typescript
import { StripeSandboxClient } from 'nesthub/stripe';

const sandbox = new StripeSandboxClient();
const pi = await sandbox.paymentIntents.create({
  amount: 1000,
  currency: 'usd',
});
// pi.id === 'pi_sandbox_1', pi.status === 'requires_payment_method'
```

### Testing with the Real Stripe SDK (Non-Sandbox)

The sandbox client replaces real Stripe API calls. If you need to test against actual Stripe test mode, simply omit `sandbox: true` and use a `sk_test_...` key:

```typescript
StripeModule.forRoot({ apiKey: 'sk_test_...' }); // real Stripe test API
```

---

## Exports

| Export                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StripeModule`                  | Main dynamic module                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `StripeService`                 | All Stripe API operations                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `StripeController`              | REST endpoints for all operations                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PaymentStore`                  | Abstract store — extend for custom ACID backends                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PAYMENT_INTENT_FINAL_STATUSES` | `['succeeded', 'failed', 'canceled']`                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `VALID_TRANSITIONS`             | State machine map                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `STRIPE_CLIENT`                 | Injection token for the raw Stripe client                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `STRIPE_MODULE_OPTIONS`         | Injection token for module config                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `STRIPE_WEBHOOK_HANDLERS`       | Injection token for webhook handlers                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Types                           | `StripeModuleOptions`, `PaymentTransaction`, `RefundRecord`, `CreatePaymentIntentInput`, `ConfirmPaymentIntentInput`, `CapturePaymentIntentInput`, `CreateRefundInput`, `CreateCustomerInput`, `CreateSubscriptionInput`, `CreateCheckoutInput`, `AttachPaymentMethodInput`, `SubscriptionStatus`, `InvoiceResult`, `PaymentMethodResult`, `PaymentIntentResult`, `RefundResult`, `PaymentIntentStatus`, `RefundStatus`, `PaymentMethodType`, `StripeWebhookHandler` |

## Testing

```bash
npx jest src/stripe/index.spec.ts
```

Tests cover: customers, subscriptions, checkout, webhooks, payment intents (create, confirm, capture, cancel, retrieve, list), refunds (create, list, cancel), payment methods (list, attach, detach), subscription update.
