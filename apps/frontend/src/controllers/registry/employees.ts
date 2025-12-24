import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Employee, EntityStatus, UUID } from './types';

type CreateEmployeeInput = {
  companyId: UUID;
  userId?: UUID | null;
  jobFunctionId?: UUID | null;
  name: string;
  document: string;
  email?: string | null;
  phone?: string | null;
  status?: EntityStatus;
};

type UpdateEmployeeInput = {
  companyId?: UUID;
  userId?: UUID | null;
  jobFunctionId?: UUID | null;
  name?: string;
  document?: string;
  email?: string | null;
  phone?: string | null;
  status?: EntityStatus;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeDocument(value: string): string {
  return value.replace(/\D+/g, '').trim();
}

function assertCompanyExists(tenantId: UUID, companyId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.companies.some(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!exists) throw new Error('company_not_found');
}

function assertUserExists(tenantId: UUID, userId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.users.some(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!exists) throw new Error('user_not_found');
}

function assertJobFunctionExists(tenantId: UUID, jobFunctionId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.jobFunctions.some(j => j.tenantId === tenantId && j.id === jobFunctionId && j.deletedAt === null);
  if (!exists) throw new Error('job_function_not_found');
}

export function listEmployees(tenantId: UUID): Employee[] {
  const store = loadRegistryStore();
  return store.employees.filter(e => e.tenantId === tenantId && e.deletedAt === null);
}

export function createEmployee(tenantId: UUID, input: CreateEmployeeInput): Employee {
  assertNonEmpty(input.companyId, 'companyId');
  assertNonEmpty(input.name, 'name');
  assertNonEmpty(input.document, 'document');

  assertCompanyExists(tenantId, input.companyId);

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const documentNormalized = normalizeDocument(input.document);
  const exists = store.employees.some(
    e => e.tenantId === tenantId && e.deletedAt === null && normalizeDocument(e.document) === documentNormalized
  );
  if (exists) throw new Error('employee_document_already_exists');

  const userId = input.userId !== undefined ? input.userId : null;
  if (userId) assertUserExists(tenantId, userId);

  const jobFunctionId = input.jobFunctionId !== undefined ? input.jobFunctionId : null;
  if (jobFunctionId) assertJobFunctionExists(tenantId, jobFunctionId);

  const employee: Employee = {
    id: createUuid(),
    tenantId,
    companyId: input.companyId,
    userId,
    jobFunctionId,
    name: input.name.trim(),
    document: input.document.trim(),
    email: input.email !== undefined ? input.email : null,
    phone: input.phone !== undefined ? input.phone : null,
    status: input.status || 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    employees: [employee, ...current.employees]
  }));

  logAuditEvent({
    tenantId,
    companyId: employee.companyId,
    action: 'CREATE',
    entityType: 'employees',
    entityId: employee.id,
    after: employee
  });

  return employee;
}

export function updateEmployee(tenantId: UUID, employeeId: UUID, patch: UpdateEmployeeInput): Employee {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.employees.find(e => e.tenantId === tenantId && e.id === employeeId && e.deletedAt === null);
  if (!existing) throw new Error('employee_not_found');

  const now = nowIso();

  const nextCompanyId = patch.companyId !== undefined ? patch.companyId : existing.companyId;
  assertCompanyExists(tenantId, nextCompanyId);

  const nextDocument = patch.document !== undefined ? patch.document : existing.document;
  assertNonEmpty(nextDocument, 'document');
  const nextDocumentNormalized = normalizeDocument(nextDocument);
  const documentExists = store.employees.some(
    e =>
      e.tenantId === tenantId &&
      e.deletedAt === null &&
      e.id !== employeeId &&
      normalizeDocument(e.document) === nextDocumentNormalized
  );
  if (documentExists) throw new Error('employee_document_already_exists');

  const nextUserId = patch.userId !== undefined ? patch.userId : existing.userId;
  if (nextUserId) assertUserExists(tenantId, nextUserId);

  const nextJobFunctionId = patch.jobFunctionId !== undefined ? patch.jobFunctionId : existing.jobFunctionId;
  if (nextJobFunctionId) assertJobFunctionExists(tenantId, nextJobFunctionId);

  const updated: Employee = {
    ...existing,
    companyId: nextCompanyId,
    userId: nextUserId !== undefined ? nextUserId : null,
    jobFunctionId: nextJobFunctionId !== undefined ? nextJobFunctionId : null,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    document: nextDocument.trim(),
    email: patch.email !== undefined ? patch.email : existing.email,
    phone: patch.phone !== undefined ? patch.phone : existing.phone,
    status: patch.status !== undefined ? patch.status : existing.status,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    employees: current.employees.map(e => (e.id === employeeId ? updated : e))
  }));

  logAuditEvent({
    tenantId,
    companyId: updated.companyId,
    action: 'UPDATE',
    entityType: 'employees',
    entityId: employeeId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteEmployee(tenantId: UUID, employeeId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.employees.find(e => e.tenantId === tenantId && e.id === employeeId && e.deletedAt === null);
  if (!existing) throw new Error('employee_not_found');

  const now = nowIso();
  const deleted: Employee = {
    ...existing,
    status: 'INACTIVE',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    employees: current.employees.map(e => (e.id === employeeId ? deleted : e))
  }));

  logAuditEvent({
    tenantId,
    companyId: deleted.companyId,
    action: 'DELETE',
    entityType: 'employees',
    entityId: employeeId,
    before: existing,
    after: deleted
  });
}

