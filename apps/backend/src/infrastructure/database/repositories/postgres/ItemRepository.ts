import { type Item as PrismaItem, Prisma, PrismaClient } from '@prisma/client';
import { IItemRepository } from '../../../../core/ports/IItemRepository';
import { Item } from '../../../../core/domain/item';

export class PrismaItemRepository implements IItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Item | null> {
    const item = await this.prisma.item.findUnique({
      where: { id },
    });
    return item ? this.mapToDomain(item) : null;
  }

  async create(item: Item): Promise<Item> {
    const createdItem = await this.prisma.item.create({
      data: this.mapToPrisma(item),
    });
    return this.mapToDomain(createdItem);
  }

  async update(id: string, item: Partial<Item>): Promise<Item> {
    const updatedItem = await this.prisma.item.update({
      where: { id },
      data: this.mapToPrismaPartial(item),
    });
    return this.mapToDomain(updatedItem);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.item.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findAll(tenantId: string): Promise<Item[]> {
    const items = await this.prisma.item.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(this.mapToDomain);
  }

  private mapToDomain(prismaItem: PrismaItem): Item {
    return {
      id: prismaItem.id,
      tenantId: prismaItem.tenantId,
      name: prismaItem.name,
      createdAt: prismaItem.createdAt,
      updatedAt: prismaItem.updatedAt,
      deletedAt: prismaItem.deletedAt ?? undefined,
      createdByUserId: prismaItem.createdByUserId ?? undefined,
      updatedByUserId: prismaItem.updatedByUserId ?? undefined,
    };
  }

  private mapToPrisma(domainItem: Item): Prisma.ItemCreateInput {
    return {
      id: domainItem.id,
      tenant: { connect: { id: domainItem.tenantId } },
      name: domainItem.name,
      createdAt: domainItem.createdAt,
      updatedAt: domainItem.updatedAt,
      deletedAt: domainItem.deletedAt,
      createdByUserId: domainItem.createdByUserId,
      updatedByUserId: domainItem.updatedByUserId,
    };
  }

  private mapToPrismaPartial(domainItem: Partial<Item>): Prisma.ItemUpdateInput {
    const prismaData: Prisma.ItemUpdateInput = {};
    if (domainItem.id !== undefined) prismaData.id = domainItem.id;
    if (domainItem.tenantId !== undefined) prismaData.tenant = { connect: { id: domainItem.tenantId } };
    if (domainItem.name !== undefined) prismaData.name = domainItem.name;
    if (domainItem.createdAt !== undefined) prismaData.createdAt = domainItem.createdAt;
    if (domainItem.updatedAt !== undefined) prismaData.updatedAt = domainItem.updatedAt;
    if (domainItem.deletedAt !== undefined) prismaData.deletedAt = domainItem.deletedAt;
    if (domainItem.createdByUserId !== undefined) prismaData.createdByUserId = domainItem.createdByUserId;
    if (domainItem.updatedByUserId !== undefined) prismaData.updatedByUserId = domainItem.updatedByUserId;
    return prismaData;
  }
}
