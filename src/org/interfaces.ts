export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrgMemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type OrgMemberStatus = 'active' | 'invited' | 'suspended';

export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  ownerId: string;
  plan?: OrgPlan;
  logoUrl?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

export interface AddMemberInput {
  userId: string;
  role?: OrgMemberRole;
  invitedBy?: string;
}

export interface OrgMemberResult {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  invitedBy?: string;
  joinedAt?: Date;
  createdAt: Date;
}

export interface OrgInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgMemberRole;
  token: string;
  expiresAt: Date;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
}

export interface OrgModuleOptions {
  typeorm: {
    enabled: boolean;
  };
  invitations?: {
    expiresInHours?: number;
  };
  slug?: {
    generator?: (name: string) => string;
  };
}
