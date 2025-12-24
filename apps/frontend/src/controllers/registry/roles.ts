import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Role, RolePermission, RoleScope, UUID } from './types';

type CreateRoleInput = {
  name: string;
  scope?: RoleScope;
  permissionIds?: UUID[];
};

type UpdateRoleInput = {
  name?: string;
  scope?: RoleScope;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function dedupe(values: UUID[]): UUID[] {
  return Array.from(new Set(values));
}

export function listRoles(tenantId: UUID): Role[] {
  const store = loadRegistryStore();
  return store.roles.filter(r => r.tenantId === tenantId && r.deletedAt === null);
}

export function createRole(tenantId: UUID, input: CreateRoleInput): Role {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const name = input.name.trim();
  const nameNormalized = normalizeName(name);
  const exists = store.roles.some(
    r => r.tenantId === tenantId && r.deletedAt === null && normalizeName(r.name) === nameNormalized
  );
  if (exists) throw new Error('role_name_already_exists');

  const role: Role = {
    id: createUuid(),
    tenantId,
    name,
    scope: input.scope || 'TENANT',
    isSystem: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, roles: [role, ...current.roles] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'roles',
    entityId: role.id,
    after: role
  });

  if (input.permissionIds && input.permissionIds.length > 0) {
    setRolePermissions(tenantId, role.id, input.permissionIds);
  }

  return role;
}

export function updateRole(tenantId: UUID, roleId: UUID, patch: UpdateRoleInput): Role {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.roles.find(r => r.tenantId === tenantId && r.id === roleId && r.deletedAt === null);
  if (!existing) throw new Error('role_not_found');

  if (existing.isSystem && (patch.name !== undefined || patch.scope !== undefined)) {
    throw new Error('role_is_system');
  }

  const now = nowIso();
  const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;

  assertNonEmpty(nextName, 'name');

  const nameNormalized = normalizeName(nextName);
  const exists = store.roles.some(
    r =>
      r.tenantId === tenantId &&
      r.deletedAt === null &&
      r.id !== roleId &&
      normalizeName(r.name) === nameNormalized
  );
  if (exists) throw new Error('role_name_already_exists');

  const updated: Role = {
    ...existing,
    name: nextName,
    scope: patch.scope !== undefined ? patch.scope : existing.scope,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    roles: current.roles.map(r => (r.id === roleId ? updated : r))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'roles',
    entityId: roleId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteRole(tenantId: UUID, roleId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.roles.find(r => r.tenantId === tenantId && r.id === roleId && r.deletedAt === null);
  if (!existing) throw new Error('role_not_found');
  if (existing.isSystem) throw new Error('role_is_system');

  const now = nowIso();
  const deleted: Role = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    roles: current.roles.map(r => (r.id === roleId ? deleted : r)),
    rolePermissions: current.rolePermissions.filter(rp => !(rp.tenantId === tenantId && rp.roleId === roleId)),
    userRoleAssignments: current.userRoleAssignments.filter(a => !(a.tenantId === tenantId && a.roleId === roleId))
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'roles',
    entityId: roleId,
    before: existing,
    after: deleted
  });
}

export function listRolePermissionIds(tenantId: UUID, roleId: UUID): UUID[] {
  const store = loadRegistryStore();
  return store.rolePermissions
    .filter(rp => rp.tenantId === tenantId && rp.roleId === roleId)
    .map(rp => rp.permissionId);
}

export function setRolePermissions(tenantId: UUID, roleId: UUID, permissionIds: UUID[]): RolePermission[] {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const roleExists = store.roles.some(r => r.tenantId === tenantId && r.id === roleId && r.deletedAt === null);
  if (!roleExists) throw new Error('role_not_found');

  const validPermissionIds = new Set(store.permissions.map(p => p.id));
  const targetPermissionIds = dedupe(permissionIds);
  const invalid = targetPermissionIds.find(id => !validPermissionIds.has(id));
  if (invalid) throw new Error('permission_not_found');

  const now = nowIso();
  const before = store.rolePermissions.filter(rp => rp.tenantId === tenantId && rp.roleId === roleId);

  const existingByPermissionId = new Map<string, RolePermission>();
  before.forEach(rp => existingByPermissionId.set(rp.permissionId, rp));

  const next: RolePermission[] = targetPermissionIds.map(permissionId => {
    const existing = existingByPermissionId.get(permissionId);
    if (existing) return existing;
    return {
      tenantId,
      roleId,
      permissionId,
      createdAt: now,
      createdByUserId: actorUserId
    };
  });

  updateRegistryStore(current => ({
    ...current,
    rolePermissions: [
      ...current.rolePermissions.filter(rp => !(rp.tenantId === tenantId && rp.roleId === roleId)),
      ...next
    ]
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'role_permissions',
    entityId: roleId,
    before: before.map(rp => rp.permissionId).sort(),
    after: next.map(rp => rp.permissionId).sort()
  });

  return next;
}
