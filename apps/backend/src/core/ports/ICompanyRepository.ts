// apps/backend/src/core/ports/ICompanyRepository.ts

import { Company } from '../domain/company';

export interface ICompanyRepository {
  findById(id: string): Promise<Company | null>;
  findByCode(tenantId: string, code: string): Promise<Company | null>;
  create(company: Company): Promise<Company>;
  update(id: string, company: Partial<Company>): Promise<Company>;
  delete(id: string): Promise<void>;
  findAll(tenantId: string): Promise<Company[]>;
}
