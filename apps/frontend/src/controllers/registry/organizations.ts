import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { EntityStatus, Organization, UUID } from './types';

type CreateOrganizationInput = {
  name: string;
  code?: string | null;
  status?: EntityStatus;
};

type UpdateOrganizationInput = {
  name?: string;
  code?: string | null;
  status?: EntityStatus;
};

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

export function listOrganizations(tenantId: UUID): Organization[] {
  const store = loadRegistryStore();
  return store.organizations.filter(o => o.tenantId === tenantId && o.deletedAt === null);
}

export function createOrganization(tenantId: UUID, input: CreateOrganizationInput): Organization {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const code = input.code !== undefined ? input.code : null;
  const normalized = code && code.trim() ? normalizeCode(code) : null;
  if (normalized) {
    const exists = store.organizations.some(
      o => o.tenantId === tenantId && o.deletedAt === null && o.code && normalizeCode(o.code) === normalized
    );
    if (exists) throw new Error('organization_code_already_exists');
  }

  const org: Organization = {
    id: createUuid(),
    tenantId,
    code: code && code.trim() ? code.trim() : null,
    name: input.name.trim(),
    status: input.status || 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, organizations: [org, ...current.organizations] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'organizations',
    entityId: org.id,
    after: org
  });

  return org;
}

export function updateOrganization(
  tenantId: UUID,
  organizationId: UUID,
  patch: UpdateOrganizationInput
): Organization {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.organizations.find(
    o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null
  );
  if (!existing) throw new Error('organization_not_found');

  const now = nowIso();
  const nextCode = patch.code !== undefined ? patch.code : existing.code;
  const nextCodeNormalized = nextCode && nextCode.trim() ? normalizeCode(nextCode) : null;

  if (nextCodeNormalized) {
    const exists = store.organizations.some(
      o =>
        o.tenantId === tenantId &&
        o.deletedAt === null &&
        o.id !== organizationId &&
        o.code &&
        normalizeCode(o.code) === nextCodeNormalized
    );
    if (exists) throw new Error('organization_code_already_exists');
  }

  const updated: Organization = {
    ...existing,
    code: nextCode && nextCode.trim() ? nextCode.trim() : null,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    status: patch.status !== undefined ? patch.status : existing.status,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    organizations: current.organizations.map(o => (o.id === organizationId ? updated : o))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'organizations',
    entityId: organizationId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteOrganization(tenantId: UUID, organizationId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.organizations.find(
    o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null
  );
  if (!existing) throw new Error('organization_not_found');

  const now = nowIso();
  const deleted: Organization = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    organizations: current.organizations.map(o => (o.id === organizationId ? deleted : o)),
    companies: current.companies.map(c =>
      c.tenantId === tenantId && c.organizationId === organizationId ? { ...c, organizationId: null } : c
    ),
    groups: current.groups.map(g =>
      g.tenantId === tenantId && g.organizationId === organizationId ? { ...g, organizationId: null } : g
    ),
    userRoleAssignments: current.userRoleAssignments.filter(
      a => !(a.tenantId === tenantId && a.scopeOrganizationId === organizationId)
    )
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'organizations',
    entityId: organizationId,
    before: existing,
    after: deleted
  });
}
