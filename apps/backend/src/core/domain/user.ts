// apps/backend/src/core/domain/user.ts

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  BLOCKED = 'BLOCKED',
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  status: UserStatus;
  passwordHash?: string;
  authProvider?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
