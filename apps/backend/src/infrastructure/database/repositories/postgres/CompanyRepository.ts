// apps/backend/src/infrastructure/database/repositories/postgres/CompanyRepository.ts

import { PrismaClient } from '@prisma/client';
import { ICompanyRepository } from '../../../../core/ports/ICompanyRepository';
import { Company, CompanyStatus } from '../../../../core/domain/company';

export class PrismaCompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Company | null> {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    return company ? this.mapToDomain(company) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Company | null> {
    const company = await this.prisma.company.findFirst({
      where: { tenantId, code },
    });
    return company ? this.mapToDomain(company) : null;
  }

  async create(company: Company): Promise<Company> {
    const createdCompany = await this.prisma.company.create({
      data: this.mapToPrisma(company),
    });
    return this.mapToDomain(createdCompany);
  }

  async update(id: string, company: Partial<Company>): Promise<Company> {
    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: this.mapToPrismaPartial(company),
    });
    return this.mapToDomain(updatedCompany);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({
      where: { id },
    });
  }

  async findAll(tenantId: string): Promise<Company[]> {
    const companies = await this.prisma.company.findMany({
      where: { tenantId },
    });
    return companies.map(this.mapToDomain);
  }

  private mapToDomain(prismaCompany: any): Company {
    return {
      id: prismaCompany.id,
      tenantId: prismaCompany.tenantId,
      organizationId: prismaCompany.organizationId || undefined,
      code: prismaCompany.code || undefined,
      legalName: prismaCompany.legalName || undefined,
      tradeName: prismaCompany.tradeName,
      taxId: prismaCompany.taxId || undefined,
      status: prismaCompany.status as CompanyStatus,
      createdAt: prismaCompany.createdAt,
      updatedAt: prismaCompany.updatedAt,
      deletedAt: prismaCompany.deletedAt || undefined,
      createdByUserId: prismaCompany.createdByUserId || undefined,
      updatedByUserId: prismaCompany.updatedByUserId || undefined,
    };
  }

  private mapToPrisma(domainCompany: Company): any {
    return {
      id: domainCompany.id,
      tenantId: domainCompany.tenantId,
      organizationId: domainCompany.organizationId,
      code: domainCompany.code,
      legalName: domainCompany.legalName,
      tradeName: domainCompany.tradeName,
      taxId: domainCompany.taxId,
      status: domainCompany.status,
      createdAt: domainCompany.createdAt,
      updatedAt: domainCompany.updatedAt,
      deletedAt: domainCompany.deletedAt,
      createdByUserId: domainCompany.createdByUserId,
      updatedByUserId: domainCompany.updatedByUserId,
    };
  }

  private mapToPrismaPartial(domainCompany: Partial<Company>): any {
    const prismaData: any = {};
    if (domainCompany.id !== undefined) prismaData.id = domainCompany.id;
    if (domainCompany.tenantId !== undefined) prismaData.tenantId = domainCompany.tenantId;
    if (domainCompany.organizationId !== undefined) prismaData.organizationId = domainCompany.organizationId;
    if (domainCompany.code !== undefined) prismaData.code = domainCompany.code;
    if (domainCompany.legalName !== undefined) prismaData.legalName = domainCompany.legalName;
    if (domainCompany.tradeName !== undefined) prismaData.tradeName = domainCompany.tradeName;
    if (domainCompany.taxId !== undefined) prismaData.taxId = domainCompany.taxId;
    if (domainCompany.status !== undefined) prismaData.status = domainCompany.status;
    if (domainCompany.createdAt !== undefined) prismaData.createdAt = domainCompany.createdAt;
    if (domainCompany.updatedAt !== undefined) prismaData.updatedAt = domainCompany.updatedAt;
    if (domainCompany.deletedAt !== undefined) prismaData.deletedAt = domainCompany.deletedAt;
    if (domainCompany.createdByUserId !== undefined) prismaData.createdByUserId = domainCompany.createdByUserId;
    if (domainCompany.updatedByUserId !== undefined) prismaData.updatedByUserId = domainCompany.updatedByUserId;
    return prismaData;
  }
}
