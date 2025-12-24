// apps/backend/src/core/domain/item.ts

export interface Item {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
