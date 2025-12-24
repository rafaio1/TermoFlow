// apps/backend/src/core/application/services/OrganizationService.ts

import { IOrganizationRepository } from '../../ports/IOrganizationRepository';
import { Organization } from '../../domain/organization';

export class OrganizationService {
  constructor(private readonly organizationRepository: IOrganizationRepository) {}

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizationRepository.findById(id);
  }

  async getOrganizationByCode(tenantId: string, code: string): Promise<Organization | null> {
    return this.organizationRepository.findByCode(tenantId, code);
  }

  async createOrganization(organization: Organization): Promise<Organization> {
    // Add business logic/validation here before creating
    return this.organizationRepository.create(organization);
  }

  async updateOrganization(id: string, organization: Partial<Organization>): Promise<Organization> {
    // Add business logic/validation here before updating
    return this.organizationRepository.update(id, organization);
  }

  async deleteOrganization(id: string): Promise<void> {
    // Add business logic/validation here before deleting
    return this.organizationRepository.delete(id);
  }

  async getAllOrganizations(tenantId: string): Promise<Organization[]> {
    return this.organizationRepository.findAll(tenantId);
  }
}
