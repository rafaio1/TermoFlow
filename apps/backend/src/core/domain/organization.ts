// apps/backend/src/core/domain/organization.ts

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Organization {
  id: string;
  tenantId: string;
  code?: string;
  name: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
