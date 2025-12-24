import { loadRegistryStore } from '../controllers/registry';
import type { RegistryStore, UUID } from '../controllers/registry';

export type CurrentContext = {
  tenantId: string | null;
  userId: string | null;
};

function normalizePermissionKey(key: string): string {
  return key.trim().toLowerCase();
}

export function getCurrentContext(): CurrentContext {
  const store = loadRegistryStore();
  const tenantId =
    store.ui.currentTenantId || (store.tenants.find(t => t.deletedAt === null)?.id ?? null);

  return { tenantId, userId: store.ui.currentUserId };
}

export function getPermissionKeysForUser(store: RegistryStore, tenantId: UUID, userId: UUID): Set<string> {
  const rolesById = new Map(
    store.roles
      .filter(r => r.tenantId === tenantId && r.deletedAt === null)
      .map(r => [r.id, r])
  );

  const permissionKeyById = new Map<string, string>(
    store.permissions
      .filter(p => p && typeof p.key === 'string')
      .map(p => [p.id, normalizePermissionKey(p.key)])
  );

  const rolePermissionIdsByRoleId = new Map<string, string[]>();
  store.rolePermissions.forEach(rp => {
    if (rp.tenantId !== tenantId) return;
    const current = rolePermissionIdsByRoleId.get(rp.roleId) || [];
    current.push(rp.permissionId);
    rolePermissionIdsByRoleId.set(rp.roleId, current);
  });

  const keys = new Set<string>();

  store.userRoleAssignments.forEach(a => {
    if (a.tenantId !== tenantId) return;
    if (a.userId !== userId) return;
    const role = rolesById.get(a.roleId);
    if (!role) return;

    const permissionIds = rolePermissionIdsByRoleId.get(role.id) || [];
    permissionIds.forEach(permissionId => {
      const key = permissionKeyById.get(permissionId);
      if (!key) return;
      keys.add(key);
    });
  });

  return keys;
}

export function getCurrentUserPermissionKeys(): Set<string> {
  const store = loadRegistryStore();
  const { tenantId, userId } = getCurrentContext();
  if (!tenantId || !userId) return new Set();
  return getPermissionKeysForUser(store, tenantId, userId);
}

export function currentUserHasPermission(permissionKey: string): boolean {
  const keys = getCurrentUserPermissionKeys();
  return keys.has(normalizePermissionKey(permissionKey));
}

export function currentUserHasAnyPermission(permissionKeys: string[]): boolean {
  const keys = getCurrentUserPermissionKeys();
  return permissionKeys.some(permissionKey => keys.has(normalizePermissionKey(permissionKey)));
}

export function isCurrentUserAdmin(): boolean {
  const store = loadRegistryStore();
  const { tenantId, userId } = getCurrentContext();
  if (!tenantId || !userId) return false;

  const rolesById = new Map(
    store.roles
      .filter(r => r.tenantId === tenantId && r.deletedAt === null)
      .map(r => [r.id, r])
  );

  return store.userRoleAssignments.some(a => {
    if (a.tenantId !== tenantId) return false;
    if (a.userId !== userId) return false;
    const role = rolesById.get(a.roleId);
    return !!role && role.name.trim().toLowerCase() === 'admin';
  });
}
