import { logAuditEvent } from './audit';
import { getDefaultCompanyIdForUser } from './access';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { User, UserStatus, UUID } from './types';

type CreateUserInput = {
  email: string;
  name: string;
  status?: UserStatus;
  passwordHash?: string | null;
  authProvider?: string | null;
};

type UpdateUserInput = {
  email?: string;
  name?: string;
  status?: UserStatus;
  passwordHash?: string | null;
  authProvider?: string | null;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function listUsers(tenantId: UUID): User[] {
  const store = loadRegistryStore();
  return store.users.filter(u => u.tenantId === tenantId && u.deletedAt === null);
}

export function createUser(tenantId: UUID, input: CreateUserInput): User {
  assertNonEmpty(input.email, 'email');
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const email = normalizeEmail(input.email);
  const exists = store.users.some(
    u => u.tenantId === tenantId && u.deletedAt === null && normalizeEmail(u.email) === email
  );
  if (exists) throw new Error('user_email_already_exists');

  const user: User = {
    id: createUuid(),
    tenantId,
    email,
    name: input.name.trim(),
    status: input.status || 'INVITED',
    passwordHash: input.passwordHash !== undefined ? input.passwordHash : null,
    authProvider: input.authProvider !== undefined ? input.authProvider : null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, users: [user, ...current.users] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'users',
    entityId: user.id,
    after: { ...user, passwordHash: null }
  });

  return user;
}

export function updateUser(tenantId: UUID, userId: UUID, patch: UpdateUserInput): User {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.users.find(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!existing) throw new Error('user_not_found');

  const now = nowIso();
  const nextEmail = patch.email !== undefined ? normalizeEmail(patch.email) : existing.email;
  if (nextEmail) {
    const exists = store.users.some(
      u =>
        u.tenantId === tenantId &&
        u.deletedAt === null &&
        u.id !== userId &&
        normalizeEmail(u.email) === nextEmail
    );
    if (exists) throw new Error('user_email_already_exists');
  }

  const updated: User = {
    ...existing,
    email: nextEmail,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    status: patch.status !== undefined ? patch.status : existing.status,
    passwordHash: patch.passwordHash !== undefined ? patch.passwordHash : existing.passwordHash,
    authProvider: patch.authProvider !== undefined ? patch.authProvider : existing.authProvider,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.email, 'email');
  assertNonEmpty(updated.name, 'name');

  updateRegistryStore(current => ({
    ...current,
    users: current.users.map(u => (u.id === userId ? updated : u))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: userId,
    before: { ...existing, passwordHash: null },
    after: { ...updated, passwordHash: null }
  });

  return updated;
}

export function deleteUser(tenantId: UUID, userId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.users.find(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!existing) throw new Error('user_not_found');

  const now = nowIso();
  const deleted: User = {
    ...existing,
    status: 'BLOCKED',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    users: current.users.map(u => (u.id === userId ? deleted : u)),
    userCompanyMemberships: current.userCompanyMemberships.filter(
      m => !(m.tenantId === tenantId && m.userId === userId)
    ),
    userRoleAssignments: current.userRoleAssignments.filter(a => !(a.tenantId === tenantId && a.userId === userId)),
    employees: current.employees.map(e =>
      e.tenantId === tenantId && e.userId === userId
        ? { ...e, userId: null, updatedAt: now, updatedByUserId: actorUserId }
        : e
    ),
    ui: { ...current.ui, currentUserId: current.ui.currentUserId === userId ? null : current.ui.currentUserId }
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'users',
    entityId: userId,
    before: { ...existing, passwordHash: null },
    after: { ...deleted, passwordHash: null }
  });
}

export function actAsUser(tenantId: UUID, userId: UUID): User {
  const store = loadRegistryStore();

  const existing = store.users.find(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!existing) throw new Error('user_not_found');

  const now = nowIso();
  const defaultCompanyId = getDefaultCompanyIdForUser(tenantId, userId);
  const updated: User = {
    ...existing,
    status: existing.status === 'INVITED' ? 'ACTIVE' : existing.status,
    lastLoginAt: now,
    updatedAt: now,
    updatedByUserId: userId
  };

  updateRegistryStore(current => ({
    ...current,
    ui: { ...current.ui, currentUserId: userId, currentCompanyId: defaultCompanyId },
    users: current.users.map(u => (u.id === userId ? updated : u))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: userId,
    before: { ...existing, passwordHash: null },
    after: { ...updated, passwordHash: null }
  });

  return updated;
}
