// apps/backend/src/infrastructure/database/repositories/postgres/UserRepository.ts

import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../../../core/ports/IUserRepository';
import { User, UserStatus } from '../../../../core/domain/user';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { email },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async create(user: User): Promise<User> {
    const createdUser = await this.prisma.user.create({
      data: this.mapToPrisma(user),
    });
    return this.mapToDomain(createdUser);
  }

  async update(id: string, user: Partial<User>): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: this.mapToPrismaPartial(user),
    });
    return this.mapToDomain(updatedUser);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async findAll(tenantId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
    });
    return users.map(this.mapToDomain);
  }

  private mapToDomain(prismaUser: any): User {
    return {
      id: prismaUser.id,
      tenantId: prismaUser.tenantId,
      email: prismaUser.email,
      name: prismaUser.name,
      status: prismaUser.status as UserStatus,
      passwordHash: prismaUser.passwordHash || undefined,
      authProvider: prismaUser.authProvider || undefined,
      lastLoginAt: prismaUser.lastLoginAt || undefined,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      deletedAt: prismaUser.deletedAt || undefined,
      createdByUserId: prismaUser.createdByUserId || undefined,
      updatedByUserId: prismaUser.updatedByUserId || undefined,
    };
  }

  private mapToPrisma(domainUser: User): any {
    return {
      id: domainUser.id,
      tenantId: domainUser.tenantId,
      email: domainUser.email,
      name: domainUser.name,
      status: domainUser.status,
      passwordHash: domainUser.passwordHash,
      authProvider: domainUser.authProvider,
      lastLoginAt: domainUser.lastLoginAt,
      createdAt: domainUser.createdAt,
      updatedAt: domainUser.updatedAt,
      deletedAt: domainUser.deletedAt,
      createdByUserId: domainUser.createdByUserId,
      updatedByUserId: domainUser.updatedByUserId,
    };
  }

  private mapToPrismaPartial(domainUser: Partial<User>): any {
    const prismaData: any = {};
    if (domainUser.id !== undefined) prismaData.id = domainUser.id;
    if (domainUser.tenantId !== undefined) prismaData.tenantId = domainUser.tenantId;
    if (domainUser.email !== undefined) prismaData.email = domainUser.email;
    if (domainUser.name !== undefined) prismaData.name = domainUser.name;
    if (domainUser.status !== undefined) prismaData.status = domainUser.status;
    if (domainUser.passwordHash !== undefined) prismaData.passwordHash = domainUser.passwordHash;
    if (domainUser.authProvider !== undefined) prismaData.authProvider = domainUser.authProvider;
    if (domainUser.lastLoginAt !== undefined) prismaData.lastLoginAt = domainUser.lastLoginAt;
    if (domainUser.createdAt !== undefined) prismaData.createdAt = domainUser.createdAt;
    if (domainUser.updatedAt !== undefined) prismaData.updatedAt = domainUser.updatedAt;
    if (domainUser.deletedAt !== undefined) prismaData.deletedAt = domainUser.deletedAt;
    if (domainUser.createdByUserId !== undefined) prismaData.createdByUserId = domainUser.createdByUserId;
    if (domainUser.updatedByUserId !== undefined) prismaData.updatedByUserId = domainUser.updatedByUserId;
    return prismaData;
  }
}
