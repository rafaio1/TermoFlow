// apps/backend/src/core/domain/company.ts

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Company {
  id: string;
  tenantId: string;
  organizationId?: string;
  code?: string;
  legalName?: string;
  tradeName: string;
  taxId?: string;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
