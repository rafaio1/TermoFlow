// apps/backend/src/core/ports/ITenantRepository.ts

import { Tenant } from '../domain/tenant';

export interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findByName(name: string): Promise<Tenant | null>;
  create(tenant: Tenant): Promise<Tenant>;
  update(id: string, tenant: Partial<Tenant>): Promise<Tenant>;
  delete(id: string): Promise<void>;
  findAll(): Promise<Tenant[]>;
}
