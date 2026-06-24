import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('stripe_locks')
export class StripeLockEntity {
  @PrimaryColumn()
  key: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;
}
