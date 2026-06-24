import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaymentTransaction, RefundRecord } from '../interfaces';
import { PaymentStore } from '../interfaces';
import { PaymentTransactionEntity } from './payment-transaction.entity';
import { RefundRecordEntity } from './refund-record.entity';
import { StripeLockEntity } from './stripe-lock.entity';

function toPaymentTransaction(
  entity: PaymentTransactionEntity,
): PaymentTransaction {
  return {
    id: entity.id,
    paymentIntentId: entity.paymentIntentId,
    amount: entity.amount,
    currency: entity.currency,
    status: entity.status as PaymentTransaction['status'],
    customerId: entity.customerId,
    paymentMethodId: entity.paymentMethodId,
    description: entity.description,
    metadata: entity.metadata,
    error: entity.error,
    idempotencyKey: entity.idempotencyKey,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function toRefundRecord(entity: RefundRecordEntity): RefundRecord {
  return {
    id: entity.id,
    refundId: entity.refundId,
    paymentIntentId: entity.paymentIntentId,
    amount: entity.amount,
    currency: entity.currency,
    status: entity.status as RefundRecord['status'],
    reason: entity.reason,
    metadata: entity.metadata,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

@Injectable()
export class TypeOrmPaymentStore extends PaymentStore {
  constructor(
    @InjectRepository(PaymentTransactionEntity)
    private readonly txRepo: Repository<PaymentTransactionEntity>,
    @InjectRepository(RefundRecordEntity)
    private readonly refundRepo: Repository<RefundRecordEntity>,
    @InjectRepository(StripeLockEntity)
    private readonly lockRepo: Repository<StripeLockEntity>,
  ) {
    super();
  }

  async saveTransaction(tx: PaymentTransaction): Promise<void> {
    const entity = this.txRepo.create(
      tx as unknown as PaymentTransactionEntity,
    );
    await this.txRepo.save(entity);
  }

  async updateTransaction(
    paymentIntentId: string,
    update: Partial<PaymentTransaction>,
  ): Promise<void> {
    await this.txRepo.update({ paymentIntentId }, update);
  }

  async getTransaction(
    paymentIntentId: string,
  ): Promise<PaymentTransaction | undefined> {
    const entity = await this.txRepo.findOneBy({ paymentIntentId });
    return entity ? toPaymentTransaction(entity) : undefined;
  }

  async saveRefund(refund: RefundRecord): Promise<void> {
    const entity = this.refundRepo.create(
      refund as unknown as RefundRecordEntity,
    );
    await this.refundRepo.save(entity);
  }

  async updateRefund(
    refundId: string,
    update: Partial<RefundRecord>,
  ): Promise<void> {
    await this.refundRepo.update({ refundId }, update);
  }

  async getRefund(refundId: string): Promise<RefundRecord | undefined> {
    const entity = await this.refundRepo.findOneBy({ refundId });
    return entity ? toRefundRecord(entity) : undefined;
  }

  async listRefunds(paymentIntentId?: string): Promise<RefundRecord[]> {
    const where = paymentIntentId ? { paymentIntentId } : {};
    const entities = await this.refundRepo.find({ where });
    return entities.map(toRefundRecord);
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const existing = await this.lockRepo.findOneBy({ key });

    if (existing) {
      if (existing.expiresAt > new Date()) {
        return false;
      }
      existing.expiresAt = new Date(Date.now() + ttlMs);
      await this.lockRepo.save(existing);
      return true;
    }

    await this.lockRepo.save(
      this.lockRepo.create({
        key,
        expiresAt: new Date(Date.now() + ttlMs),
      }),
    );
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    await this.lockRepo.delete({ key });
  }
}
