// apps/backend/src/infrastructure/database/repositories/postgres/TenantRepository.ts

import { PrismaClient } from '@prisma/client';
import { ITenantRepository } from '../../../../core/ports/ITenantRepository';
import { Tenant, TenantStatus } from '../../../../core/domain/tenant';

export class PrismaTenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Tenant | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    return tenant ? this.mapToDomain(tenant) : null;
  }

  async findByName(name: string): Promise<Tenant | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { name },
    });
    return tenant ? this.mapToDomain(tenant) : null;
  }

  async create(tenant: Tenant): Promise<Tenant> {
    const createdTenant = await this.prisma.tenant.create({
      data: this.mapToPrisma(tenant),
    });
    return this.mapToDomain(createdTenant);
  }

  async update(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
    const updatedTenant = await this.prisma.tenant.update({
      where: { id },
      data: this.mapToPrismaPartial(tenant),
    });
    return this.mapToDomain(updatedTenant);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({
      where: { id },
    });
  }

  async findAll(): Promise<Tenant[]> {
    const tenants = await this.prisma.tenant.findMany();
    return tenants.map(this.mapToDomain);
  }

  private mapToDomain(prismaTenant: any): Tenant {
    return {
      id: prismaTenant.id,
      name: prismaTenant.name,
      status: prismaTenant.status as TenantStatus,
      primaryDomain: prismaTenant.primaryDomain || undefined,
      createdAt: prismaTenant.createdAt,
      updatedAt: prismaTenant.updatedAt,
      deletedAt: prismaTenant.deletedAt || undefined,
      createdByUserId: prismaTenant.createdByUserId || undefined,
      updatedByUserId: prismaTenant.updatedByUserId || undefined,
    };
  }

  private mapToPrisma(domainTenant: Tenant): any {
    return {
      id: domainTenant.id,
      name: domainTenant.name,
      status: domainTenant.status,
      primaryDomain: domainTenant.primaryDomain,
      createdAt: domainTenant.createdAt,
      updatedAt: domainTenant.updatedAt,
      deletedAt: domainTenant.deletedAt,
      createdByUserId: domainTenant.createdByUserId,
      updatedByUserId: domainTenant.updatedByUserId,
    };
  }

  private mapToPrismaPartial(domainTenant: Partial<Tenant>): any {
    const prismaData: any = {};
    if (domainTenant.id !== undefined) prismaData.id = domainTenant.id;
    if (domainTenant.name !== undefined) prismaData.name = domainTenant.name;
    if (domainTenant.status !== undefined) prismaData.status = domainTenant.status;
    if (domainTenant.primaryDomain !== undefined) prismaData.primaryDomain = domainTenant.primaryDomain;
    if (domainTenant.createdAt !== undefined) prismaData.createdAt = domainTenant.createdAt;
    if (domainTenant.updatedAt !== undefined) prismaData.updatedAt = domainTenant.updatedAt;
    if (domainTenant.deletedAt !== undefined) prismaData.deletedAt = domainTenant.deletedAt;
    if (domainTenant.createdByUserId !== undefined) prismaData.createdByUserId = domainTenant.createdByUserId;
    if (domainTenant.updatedByUserId !== undefined) prismaData.updatedByUserId = domainTenant.updatedByUserId;
    return prismaData;
  }
}
