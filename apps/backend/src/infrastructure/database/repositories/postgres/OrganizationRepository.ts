import { type Organization as PrismaOrganization, OrganizationStatus as PrismaOrganizationStatus, Prisma, PrismaClient } from '@prisma/client';
import { IOrganizationRepository } from '../../../../core/ports/IOrganizationRepository';
import { Organization, OrganizationStatus } from '../../../../core/domain/organization';

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Organization | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });
    return organization ? this.mapToDomain(organization) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Organization | null> {
    const organization = await this.prisma.organization.findFirst({
      where: { tenantId, code },
    });
    return organization ? this.mapToDomain(organization) : null;
  }

  async create(organization: Organization): Promise<Organization> {
    const createdOrganization = await this.prisma.organization.create({
      data: this.mapToPrisma(organization),
    });
    // Assuming audit events are handled by the service or a separate mechanism
    return this.mapToDomain(createdOrganization);
  }

  async update(id: string, organization: Partial<Organization>): Promise<Organization> {
    const updatedOrganization = await this.prisma.organization.update({
      where: { id },
      data: this.mapToPrismaPartial(organization),
    });
    // Assuming audit events are handled by the service or a separate mechanism
    return this.mapToDomain(updatedOrganization);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    // Assuming audit events are handled by the service or a separate mechanism
  }

  async findAll(tenantId: string): Promise<Organization[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return organizations.map(this.mapToDomain);
  }

  private mapToDomain(prismaOrganization: PrismaOrganization): Organization {
    return {
      id: prismaOrganization.id,
      tenantId: prismaOrganization.tenantId,
      code: prismaOrganization.code ?? undefined,
      name: prismaOrganization.name,
      status: prismaOrganization.status as OrganizationStatus, // Cast from Prisma enum to Domain enum
      createdAt: prismaOrganization.createdAt,
      updatedAt: prismaOrganization.updatedAt,
      deletedAt: prismaOrganization.deletedAt ?? undefined,
      createdByUserId: prismaOrganization.createdByUserId ?? undefined,
      updatedByUserId: prismaOrganization.updatedByUserId ?? undefined,
    };
  }

  private mapToPrisma(domainOrganization: Organization): Prisma.OrganizationCreateInput {
    return {
      id: domainOrganization.id,
      tenant: { connect: { id: domainOrganization.tenantId } },
      code: domainOrganization.code,
      name: domainOrganization.name,
      status: domainOrganization.status as PrismaOrganizationStatus, // Cast from Domain enum to Prisma enum
      createdAt: domainOrganization.createdAt,
      updatedAt: domainOrganization.updatedAt,
      deletedAt: domainOrganization.deletedAt,
      createdByUserId: domainOrganization.createdByUserId,
      updatedByUserId: domainOrganization.updatedByUserId,
    };
  }

  private mapToPrismaPartial(domainOrganization: Partial<Organization>): Prisma.OrganizationUpdateInput {
    const prismaData: Prisma.OrganizationUpdateInput = {};
    if (domainOrganization.id !== undefined) prismaData.id = domainOrganization.id;
    if (domainOrganization.tenantId !== undefined) prismaData.tenant = { connect: { id: domainOrganization.tenantId } };
    if (domainOrganization.code !== undefined) prismaData.code = domainOrganization.code;
    if (domainOrganization.name !== undefined) prismaData.name = domainOrganization.name;
    if (domainOrganization.status !== undefined) prismaData.status = domainOrganization.status as PrismaOrganizationStatus;
    if (domainOrganization.createdAt !== undefined) prismaData.createdAt = domainOrganization.createdAt;
    if (domainOrganization.updatedAt !== undefined) prismaData.updatedAt = domainOrganization.updatedAt;
    if (domainOrganization.deletedAt !== undefined) prismaData.deletedAt = domainOrganization.deletedAt;
    if (domainOrganization.createdByUserId !== undefined) prismaData.createdByUserId = domainOrganization.createdByUserId;
    if (domainOrganization.updatedByUserId !== undefined) prismaData.updatedByUserId = domainOrganization.updatedByUserId;
    return prismaData;
  }
}
