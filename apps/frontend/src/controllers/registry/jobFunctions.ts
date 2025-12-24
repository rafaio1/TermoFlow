import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { JobFunction, UUID } from './types';

type CreateJobFunctionInput = {
  name: string;
  code?: string | null;
};

type UpdateJobFunctionInput = {
  name?: string;
  code?: string | null;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export function listJobFunctions(tenantId: UUID): JobFunction[] {
  const store = loadRegistryStore();
  return store.jobFunctions.filter(j => j.tenantId === tenantId && j.deletedAt === null);
}

export function createJobFunction(tenantId: UUID, input: CreateJobFunctionInput): JobFunction {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const code = input.code !== undefined ? input.code : null;
  const codeNormalized = code && code.trim() ? normalizeCode(code) : null;
  if (codeNormalized) {
    const exists = store.jobFunctions.some(
      j =>
        j.tenantId === tenantId &&
        j.deletedAt === null &&
        j.code &&
        normalizeCode(j.code) === codeNormalized
    );
    if (exists) throw new Error('job_function_code_already_exists');
  }

  const jobFunction: JobFunction = {
    id: createUuid(),
    tenantId,
    name: input.name.trim(),
    code: code && code.trim() ? code.trim() : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    jobFunctions: [jobFunction, ...current.jobFunctions]
  }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'job_functions',
    entityId: jobFunction.id,
    after: jobFunction
  });

  return jobFunction;
}

export function updateJobFunction(tenantId: UUID, jobFunctionId: UUID, patch: UpdateJobFunctionInput): JobFunction {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.jobFunctions.find(j => j.tenantId === tenantId && j.id === jobFunctionId && j.deletedAt === null);
  if (!existing) throw new Error('job_function_not_found');

  const now = nowIso();
  const nextCode = patch.code !== undefined ? patch.code : existing.code;
  const nextCodeNormalized = nextCode && nextCode.trim() ? normalizeCode(nextCode) : null;
  if (nextCodeNormalized) {
    const exists = store.jobFunctions.some(
      j =>
        j.tenantId === tenantId &&
        j.deletedAt === null &&
        j.id !== jobFunctionId &&
        j.code &&
        normalizeCode(j.code) === nextCodeNormalized
    );
    if (exists) throw new Error('job_function_code_already_exists');
  }

  const updated: JobFunction = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    code: nextCode && nextCode.trim() ? nextCode.trim() : null,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    jobFunctions: current.jobFunctions.map(j => (j.id === jobFunctionId ? updated : j))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'job_functions',
    entityId: jobFunctionId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteJobFunction(tenantId: UUID, jobFunctionId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.jobFunctions.find(j => j.tenantId === tenantId && j.id === jobFunctionId && j.deletedAt === null);
  if (!existing) throw new Error('job_function_not_found');

  const now = nowIso();
  const deleted: JobFunction = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    jobFunctions: current.jobFunctions.map(j => (j.id === jobFunctionId ? deleted : j)),
    employees: current.employees.map(e =>
      e.tenantId === tenantId && e.jobFunctionId === jobFunctionId
        ? { ...e, jobFunctionId: null, updatedAt: now, updatedByUserId: actorUserId }
        : e
    )
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'job_functions',
    entityId: jobFunctionId,
    before: existing,
    after: deleted
  });
}

