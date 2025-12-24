// apps/backend/src/core/ports/IOrganizationRepository.ts

import { Organization } from '../domain/organization';

export interface IOrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findByCode(tenantId: string, code: string): Promise<Organization | null>;
  create(organization: Organization): Promise<Organization>;
  update(id: string, organization: Partial<Organization>): Promise<Organization>;
  delete(id: string): Promise<void>;
  findAll(tenantId: string): Promise<Organization[]>;
}
