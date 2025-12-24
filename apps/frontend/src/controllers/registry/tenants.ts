import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Role, RolePermission, Tenant, TenantSettings, TenantStatus, UUID } from './types';

type CreateTenantInput = {
  name: string;
  primaryDomain?: string | null;
  status?: TenantStatus;
};

type UpdateTenantInput = {
  name?: string;
  primaryDomain?: string | null;
  status?: TenantStatus;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function listTenants(): Tenant[] {
  const store = loadRegistryStore();
  return store.tenants.filter(t => t.deletedAt === null);
}

export function getTenantById(tenantId: UUID): Tenant | null {
  const store = loadRegistryStore();
  return store.tenants.find(t => t.id === tenantId && t.deletedAt === null) || null;
}

export function createTenant(input: CreateTenantInput): Tenant {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const tenantId = createUuid();
  const tenant: Tenant = {
    id: tenantId,
    name: input.name.trim(),
    status: input.status || 'ACTIVE',
    primaryDomain: input.primaryDomain !== undefined ? input.primaryDomain : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  const settings: TenantSettings = {
    tenantId,
    useOrganizations: false,
    useGroups: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  const roleId = createUuid();
  const adminRole: Role = {
    id: roleId,
    tenantId,
    name: 'Admin',
    scope: 'TENANT',
    isSystem: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  const rolePermissions: RolePermission[] = store.permissions.map(p => ({
    tenantId,
    roleId,
    permissionId: p.id,
    createdAt: now,
    createdByUserId: actorUserId
  }));

  updateRegistryStore(current => ({
    ...current,
    ui: { ...current.ui, currentTenantId: tenant.id, currentCompanyId: null },
    tenants: [tenant, ...current.tenants],
    tenantSettings: [settings, ...current.tenantSettings],
    roles: [adminRole, ...current.roles],
    rolePermissions: [...rolePermissions, ...current.rolePermissions]
  }));

  logAuditEvent({
    tenantId: tenant.id,
    action: 'CREATE',
    entityType: 'tenants',
    entityId: tenant.id,
    after: tenant
  });

  logAuditEvent({
    tenantId: tenant.id,
    action: 'CREATE',
    entityType: 'tenant_settings',
    entityId: tenant.id,
    after: settings
  });

  logAuditEvent({
    tenantId: tenant.id,
    action: 'CREATE',
    entityType: 'roles',
    entityId: adminRole.id,
    after: adminRole
  });

  logAuditEvent({
    tenantId: tenant.id,
    action: 'CREATE',
    entityType: 'role_permissions',
    entityId: adminRole.id,
    after: rolePermissions.map(rp => rp.permissionId).sort()
  });

  return tenant;
}

export function updateTenant(tenantId: UUID, patch: UpdateTenantInput): Tenant {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const existing = store.tenants.find(t => t.id === tenantId && t.deletedAt === null);
  if (!existing) throw new Error('tenant_not_found');

  const now = nowIso();
  const updated: Tenant = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    status: patch.status !== undefined ? patch.status : existing.status,
    primaryDomain: patch.primaryDomain !== undefined ? patch.primaryDomain : existing.primaryDomain,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    tenants: current.tenants.map(t => (t.id === tenantId ? updated : t))
  }));

  logAuditEvent({
    tenantId: tenantId,
    action: 'UPDATE',
    entityType: 'tenants',
    entityId: tenantId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteTenant(tenantId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const existing = store.tenants.find(t => t.id === tenantId && t.deletedAt === null);
  if (!existing) throw new Error('tenant_not_found');

  const now = nowIso();
  const deleted: Tenant = {
    ...existing,
    status: 'SUSPENDED',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    tenants: current.tenants.map(t => (t.id === tenantId ? deleted : t)),
    ui: {
      ...current.ui,
      currentTenantId: current.ui.currentTenantId === tenantId ? null : current.ui.currentTenantId,
      currentCompanyId: current.ui.currentTenantId === tenantId ? null : current.ui.currentCompanyId
    }
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'tenants',
    entityId: tenantId,
    before: existing,
    after: deleted
  });
}
