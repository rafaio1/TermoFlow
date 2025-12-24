import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { loadRegistryStore, updateRegistryStore } from './store';
import { EntityStatus, UserCompanyMembership, UUID } from './types';

type UpsertMembershipInput = {
  status?: EntityStatus;
  isDefault?: boolean;
};

function assertUserExists(tenantId: UUID, userId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.users.some(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!exists) throw new Error('user_not_found');
}

function assertCompanyExists(tenantId: UUID, companyId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.companies.some(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!exists) throw new Error('company_not_found');
}

function ensureDefaultForUser(
  tenantId: UUID,
  userId: UUID,
  memberships: UserCompanyMembership[],
  now: string,
  actorUserId: UUID | null
): UserCompanyMembership[] {
  const active = memberships.filter(m => m.tenantId === tenantId && m.userId === userId && m.status === 'ACTIVE');
  if (active.length === 0) return memberships;
  const hasDefault = active.some(m => m.isDefault);
  if (hasDefault) return memberships;

  const chosen = active[0];
  return memberships.map(m => {
    if (m.tenantId !== tenantId || m.userId !== userId) return m;
    if (m.companyId !== chosen.companyId) return m;
    return { ...m, isDefault: true, updatedAt: now, updatedByUserId: actorUserId };
  });
}

export function listUserCompanyMemberships(tenantId: UUID): UserCompanyMembership[] {
  const store = loadRegistryStore();
  return store.userCompanyMemberships.filter(m => m.tenantId === tenantId);
}

export function listMembershipsForUser(tenantId: UUID, userId: UUID): UserCompanyMembership[] {
  const store = loadRegistryStore();
  return store.userCompanyMemberships.filter(m => m.tenantId === tenantId && m.userId === userId);
}

export function upsertUserCompanyMembership(
  tenantId: UUID,
  userId: UUID,
  companyId: UUID,
  input: UpsertMembershipInput
): UserCompanyMembership {
  assertUserExists(tenantId, userId);
  assertCompanyExists(tenantId, companyId);

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const existing = store.userCompanyMemberships.find(
    m => m.tenantId === tenantId && m.userId === userId && m.companyId === companyId
  );

  let nextStatus: EntityStatus = existing ? existing.status : 'ACTIVE';
  if (input.status !== undefined) nextStatus = input.status;

  let nextIsDefault = existing ? existing.isDefault : false;
  if (input.isDefault !== undefined) nextIsDefault = input.isDefault;

  if (nextStatus !== 'ACTIVE') nextIsDefault = false;
  if (nextIsDefault) nextStatus = 'ACTIVE';

  const nextMembership: UserCompanyMembership = existing
    ? {
        ...existing,
        status: nextStatus,
        isDefault: nextIsDefault,
        updatedAt: now,
        updatedByUserId: actorUserId
      }
    : {
        tenantId,
        userId,
        companyId,
        status: nextStatus,
        isDefault: nextIsDefault,
        createdAt: now,
        updatedAt: now,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId
      };

  let memberships: UserCompanyMembership[] = existing
    ? store.userCompanyMemberships.map(m =>
        m.tenantId === tenantId && m.userId === userId && m.companyId === companyId ? nextMembership : m
      )
    : [nextMembership, ...store.userCompanyMemberships];

  if (nextMembership.isDefault) {
    memberships = memberships.map(m => {
      if (m.tenantId !== tenantId || m.userId !== userId) return m;
      if (m.companyId === companyId) return m;
      if (!m.isDefault) return m;
      return { ...m, isDefault: false, updatedAt: now, updatedByUserId: actorUserId };
    });
  }

  memberships = ensureDefaultForUser(tenantId, userId, memberships, now, actorUserId);

  updateRegistryStore(current => ({ ...current, userCompanyMemberships: memberships }));

  logAuditEvent({
    tenantId,
    companyId,
    action: existing ? 'UPDATE' : 'CREATE',
    entityType: 'user_company_memberships',
    entityId: userId,
    before: existing || null,
    after: nextMembership
  });

  return nextMembership;
}

export function removeUserCompanyMembership(tenantId: UUID, userId: UUID, companyId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.userCompanyMemberships.find(
    m => m.tenantId === tenantId && m.userId === userId && m.companyId === companyId
  );
  if (!existing) throw new Error('membership_not_found');

  const now = nowIso();
  let next = store.userCompanyMemberships.filter(
    m => !(m.tenantId === tenantId && m.userId === userId && m.companyId === companyId)
  );
  next = ensureDefaultForUser(tenantId, userId, next, now, actorUserId);

  updateRegistryStore(current => ({ ...current, userCompanyMemberships: next }));

  logAuditEvent({
    tenantId,
    companyId,
    action: 'DELETE',
    entityType: 'user_company_memberships',
    entityId: userId,
    before: existing,
    after: null
  });
}

