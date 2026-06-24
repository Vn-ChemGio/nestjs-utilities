import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OrganizationMember } from './organization-member.entity.js';

export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrgMemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrgMemberStatus = 'active' | 'invited' | 'suspended';

@Entity('org_organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  slug: string;

  @Column({ name: 'logo_url', nullable: true, length: 1024 })
  logoUrl?: string;

  @Column({ name: 'plan', default: 'free', length: 50 })
  plan: OrgPlan;

  @Column({ name: 'settings', nullable: true, type: 'simple-json' })
  settings?: Record<string, unknown>;

  @Column({ name: 'owner_id', length: 255 })
  ownerId: string;

  @Column({ name: 'trial_ends_at', nullable: true })
  trialEndsAt?: Date;

  @Column({ name: 'subscription_id', nullable: true, length: 255 })
  subscriptionId?: string;

  @Column({ name: 'stripe_customer_id', nullable: true, length: 255 })
  stripeCustomerId?: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrganizationMember, (member) => member.organization)
  members?: OrganizationMember[];
}
