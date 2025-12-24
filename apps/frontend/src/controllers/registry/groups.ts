import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Group, UUID } from './types';

type CreateGroupInput = {
  name: string;
  code?: string | null;
  organizationId?: UUID | null;
};

type UpdateGroupInput = {
  name?: string;
  code?: string | null;
  organizationId?: UUID | null;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

export function listGroups(tenantId: UUID): Group[] {
  const store = loadRegistryStore();
  return store.groups.filter(g => g.tenantId === tenantId && g.deletedAt === null);
}

export function createGroup(tenantId: UUID, input: CreateGroupInput): Group {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const code = input.code !== undefined ? input.code : null;

  const organizationId = input.organizationId !== undefined ? input.organizationId : null;
  if (organizationId) {
    const orgExists = store.organizations.some(
      o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null
    );
    if (!orgExists) throw new Error('organization_not_found');
  }

  const group: Group = {
    id: createUuid(),
    tenantId,
    organizationId,
    code: code && code.trim() ? code.trim() : null,
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, groups: [group, ...current.groups] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'groups',
    entityId: group.id,
    after: group
  });

  return group;
}

export function updateGroup(tenantId: UUID, groupId: UUID, patch: UpdateGroupInput): Group {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.groups.find(g => g.tenantId === tenantId && g.id === groupId && g.deletedAt === null);
  if (!existing) throw new Error('group_not_found');

  const now = nowIso();
  const nextCode = patch.code !== undefined ? patch.code : existing.code;

  const nextOrganizationId = patch.organizationId !== undefined ? patch.organizationId : existing.organizationId;
  if (nextOrganizationId) {
    const orgExists = store.organizations.some(
      o => o.tenantId === tenantId && o.id === nextOrganizationId && o.deletedAt === null
    );
    if (!orgExists) throw new Error('organization_not_found');
  }

  const updated: Group = {
    ...existing,
    organizationId: nextOrganizationId ? nextOrganizationId : null,
    code: nextCode && nextCode.trim() ? nextCode.trim() : null,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    groups: current.groups.map(g => (g.id === groupId ? updated : g))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'groups',
    entityId: groupId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteGroup(tenantId: UUID, groupId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.groups.find(g => g.tenantId === tenantId && g.id === groupId && g.deletedAt === null);
  if (!existing) throw new Error('group_not_found');

  const now = nowIso();
  const deleted: Group = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    groups: current.groups.map(g => (g.id === groupId ? deleted : g)),
    companyGroups: current.companyGroups.filter(cg => !(cg.tenantId === tenantId && cg.groupId === groupId))
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'groups',
    entityId: groupId,
    before: existing,
    after: deleted
  });
}
