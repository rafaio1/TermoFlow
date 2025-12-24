// apps/backend/src/core/domain/tenant.ts

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  primaryDomain?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
