import request from 'supertest';
import type { Express } from 'express';
import { ObjectId } from 'mongodb';
import { PrismaClient } from '@prisma/client';

// New imports for the refactored architecture
import { ItemService } from '../../src/core/application/services/ItemService';
import { ItemController } from '../../src/infrastructure/web/controllers/ItemController';
import { OrganizationController } from '../../src/infrastructure/web/controllers/OrganizationController'; // Add missing import for type

// Mocks for external dependencies (database connections)
jest.mock('../../src/infrastructure/database/postgres', () => ({
  postgres: { $queryRaw: jest.fn().mockResolvedValue(1) },
}));

jest.mock('../../src/infrastructure/database/mongo', () => ({
  getMongoDb: () => ({ command: jest.fn().mockResolvedValue({ ok: 1 }) }),
}));

// Mock for audit log repository (still directly used in controller for now)
jest.mock('../../src/infrastructure/database/repositories/mongo/auditLogRepository', () => ({
  createAuditLog: jest.fn(),
}));

import * as auditLogRepository from '../../src/infrastructure/database/repositories/mongo/auditLogRepository';
const mockCreateAuditLog = jest.mocked(auditLogRepository.createAuditLog);

// Mock the ItemService
const mockItemService = {
  getAllItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
};

// Mock the OrganizationService module (moved to top level)
const mockOrganizationServiceInstance = {
  organizationRepository: {} as any, // Mock the repository
  getAllOrganizations: jest.fn(),
  createOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  deleteOrganization: jest.fn(),
  getOrganizationById: jest.fn(),
  getOrganizationByCode: jest.fn(),
};
jest.mock('../../src/core/application/services/OrganizationService', () => ({
  OrganizationService: jest.fn(() => mockOrganizationServiceInstance),
}));
import { OrganizationService } from '../../src/core/application/services/OrganizationService'; // Re-import the mocked service

async function makeApp(
  mockedItemService: Partial<ItemService> = mockItemService,
): Promise<Express> {
  const mod = await import('../../src/app');
  // The postgres client is mocked globally by jest.mock at the top,
  // so createApp will receive the mocked version through its internal imports.
  const { postgres } = await import('../../src/infrastructure/database/postgres'); // Re-import to get the mocked version

  const itemController = new ItemController(mockedItemService as ItemService);

  // Instantiate the mocked OrganizationService and OrganizationController
  const organizationService = new OrganizationService(null as any); // Constructor takes a repo, but we are fully mocking methods
  const organizationController = new OrganizationController(organizationService);

  return mod.createApp({
    postgres: postgres as unknown as PrismaClient,
    itemController,
    organizationController,
  });
}

describe('items routes', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  it('GET /items requires x-tenant-id', async () => {
    const app = await makeApp();
    await request(app).get('/items').expect(400);
  });

  it('GET /items returns items list', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    mockItemService.getAllItems.mockResolvedValueOnce([
      {
        id: '11111111-1111-1111-1111-111111111111',
        tenantId,
        name: 'A',
        createdByUserId: undefined,
        updatedByUserId: undefined,
        deletedAt: undefined,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const app = await makeApp();
    const res = await request(app).get('/items').set('x-tenant-id', tenantId).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(mockItemService.getAllItems).toHaveBeenCalledWith(tenantId);
    expect(res.body[0]).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'A',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('POST /items creates item and audit log', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    const newItemId = '22222222-2222-2222-2222-222222222222';
    mockItemService.createItem.mockResolvedValueOnce({
      id: newItemId,
      tenantId,
      name: 'Teste',
      createdByUserId: userId,
      updatedByUserId: userId,
      deletedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
    mockCreateAuditLog.mockResolvedValueOnce({ _id: new ObjectId() });

    const app = await makeApp();
    const res = await request(app)
      .post('/items')
      .send({ name: '  Teste  ' })
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .set('Content-Type', 'application/json')
      .expect(201);

    expect(mockItemService.createItem).toHaveBeenCalledWith({
      id: '', // id is passed as empty, service/repo generates it
      name: 'Teste',
      tenantId,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: expect.any(Date), // dates are created in controller
      updatedAt: expect.any(Date),
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'item.created',
      payload: { itemId: newItemId },
      tenantId,
      actorUserId: userId,
    });

    expect(res.body).toMatchObject({
      id: newItemId,
      name: 'Teste',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it('POST /items validates body', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/items')
      .send({ name: '' })
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .set('Content-Type', 'application/json')
      .expect(400);

    expect(res.body).toHaveProperty('error', 'Validation Error');
  });
});
