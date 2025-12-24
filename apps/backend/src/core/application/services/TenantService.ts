// apps/backend/src/core/application/services/TenantService.ts

import { ITenantRepository } from '../../ports/ITenantRepository';
import { Tenant } from '../../domain/tenant';

export class TenantService {
  constructor(private readonly tenantRepository: ITenantRepository) {}

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(id);
  }

  async getTenantByName(name: string): Promise<Tenant | null> {
    return this.tenantRepository.findByName(name);
  }

  async createTenant(tenant: Tenant): Promise<Tenant> {
    // Add business logic/validation here before creating
    return this.tenantRepository.create(tenant);
  }

  async updateTenant(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
    // Add business logic/validation here before updating
    return this.tenantRepository.update(id, tenant);
  }

  async deleteTenant(id: string): Promise<void> {
    // Add business logic/validation here before deleting
    return this.tenantRepository.delete(id);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.findAll();
  }
}
