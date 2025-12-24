import request from 'supertest';
import type { Express } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';

// New imports for the refactored architecture
import { ItemController } from '../../src/infrastructure/web/controllers/ItemController';
import { OrganizationController } from '../../src/infrastructure/web/controllers/OrganizationController';

// Updated mocks for external dependencies (database connections)
jest.mock('../../src/infrastructure/database/postgres', () => ({
  postgres: { $queryRaw: jest.fn().mockResolvedValue(1) },
}));

jest.mock('../../src/infrastructure/database/mongo', () => ({
  getMongoDb: () => ({ command: jest.fn().mockResolvedValue({ ok: 1 }) }),
}));

// Mock for audit log repository (still directly used in ItemController for now)
jest.mock('../../src/infrastructure/database/repositories/mongo/auditLogRepository', () => ({
  createAuditLog: jest.fn(),
}));

import * as auditLogRepository from '../../src/infrastructure/database/repositories/mongo/auditLogRepository';
const mockCreateAuditLog = jest.mocked(auditLogRepository.createAuditLog);

// Mock the ItemService module
const mockItemServiceInstance = {
  itemRepository: {} as any, // Mock the repository
  getAllItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  getItemById: jest.fn(),
};
jest.mock('../../src/core/application/services/ItemService', () => ({
  ItemService: jest.fn(() => mockItemServiceInstance),
}));
// Re-import the mocked ItemService to ensure it's used
import { ItemService } from '../../src/core/application/services/ItemService';

// Mock the OrganizationService module
const mockOrganizationServiceInstance = {
  organizationRepository: {} as any, // Mock the repository
  getAllOrganizations: jest.fn(),
  createOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  deleteOrganization: jest.fn(),
  getOrganizationById: jest.fn(), // Add missing method
  getOrganizationByCode: jest.fn(), // Add missing method
};
jest.mock('../../src/core/application/services/OrganizationService', () => ({
  OrganizationService: jest.fn(() => mockOrganizationServiceInstance),
}));
// Re-import the mocked OrganizationService to ensure it's used
import { OrganizationService } from '../../src/core/application/services/OrganizationService';


async function makeApp(): Promise<Express> {
  const mod = await import('../../src/app');
  // The postgres client is mocked globally by jest.mock at the top,
  // so createApp will receive the mocked version through its internal imports.
  const { postgres } = await import('../../src/infrastructure/database/postgres'); // Re-import to get the mocked version

  const itemController = new ItemController(new ItemService(null as any));
  const organizationController = new OrganizationController(new OrganizationService(null as any));

  return mod.createApp({
    postgres: postgres as unknown as PrismaClient, // Cast as PrismaClient
    itemController,
    organizationController,
  });
}

function makeKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('error handler (Prisma)', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  it.each([
    ['P2002', 409, 'Conflict'],
    ['P2003', 400, 'Invalid Reference'],
    ['P2025', 404, 'Not Found'],
  ])('maps %s to %s', async (code, status, error) => {
    mockItemServiceInstance.createItem.mockRejectedValueOnce(makeKnownError(String(code)));

    const app = await makeApp();
    const res = await request(app)
      .post('/items')
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .send({ name: 'Item' })
      .set('Content-Type', 'application/json')
      .expect(Number(status));

    expect(res.body).toMatchObject({ error });
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});