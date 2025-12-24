// apps/backend/src/core/application/services/CompanyService.ts

import { ICompanyRepository } from '../../ports/ICompanyRepository';
import { Company } from '../../domain/company';

export class CompanyService {
  constructor(private readonly companyRepository: ICompanyRepository) {}

  async getCompanyById(id: string): Promise<Company | null> {
    return this.companyRepository.findById(id);
  }

  async getCompanyByCode(tenantId: string, code: string): Promise<Company | null> {
    return this.companyRepository.findByCode(tenantId, code);
  }

  async createCompany(company: Company): Promise<Company> {
    // Add business logic/validation here before creating
    return this.companyRepository.create(company);
  }

  async updateCompany(id: string, company: Partial<Company>): Promise<Company> {
    // Add business logic/validation here before updating
    return this.companyRepository.update(id, company);
  }

  async deleteCompany(id: string): Promise<void> {
    // Add business logic/validation here before deleting
    return this.companyRepository.delete(id);
  }

  async getAllCompanies(tenantId: string): Promise<Company[]> {
    return this.companyRepository.findAll(tenantId);
  }
}
