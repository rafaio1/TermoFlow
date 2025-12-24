import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Role, UserRoleAssignment, UUID } from './types';

type CreateUserRoleAssignmentInput = {
  userId: UUID;
  roleId: UUID;
  scopeCompanyId?: UUID | null;
  scopeOrganizationId?: UUID | null;
};

function assignmentKey(tenantId: UUID, a: { userId: UUID; roleId: UUID; scopeCompanyId: UUID | null; scopeOrganizationId: UUID | null }): string {
  return `${tenantId}:${a.userId}:${a.roleId}:${a.scopeCompanyId || ''}:${a.scopeOrganizationId || ''}`;
}

function assertUserExists(tenantId: UUID, userId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.users.some(u => u.tenantId === tenantId && u.id === userId && u.deletedAt === null);
  if (!exists) throw new Error('user_not_found');
}

function getRoleOrThrow(tenantId: UUID, roleId: UUID): Role {
  const store = loadRegistryStore();
  const role = store.roles.find(r => r.tenantId === tenantId && r.id === roleId && r.deletedAt === null);
  if (!role) throw new Error('role_not_found');
  return role;
}

function assertCompanyExists(tenantId: UUID, companyId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.companies.some(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!exists) throw new Error('company_not_found');
}

function assertOrganizationExists(tenantId: UUID, organizationId: UUID): void {
  const store = loadRegistryStore();
  const exists = store.organizations.some(
    o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null
  );
  if (!exists) throw new Error('organization_not_found');
}

function normalizeByRoleScope(role: Role, input: CreateUserRoleAssignmentInput): UserRoleAssignment {
  const store = loadRegistryStore();
  const now = nowIso();
  const actorUserId = store.ui.currentUserId;

  const scopeCompanyId = input.scopeCompanyId !== undefined ? input.scopeCompanyId : null;
  const scopeOrganizationId = input.scopeOrganizationId !== undefined ? input.scopeOrganizationId : null;

  if (role.scope === 'TENANT') {
    if (scopeCompanyId || scopeOrganizationId) throw new Error('invalid_role_scope');
    return {
      tenantId: role.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      scopeCompanyId: null,
      scopeOrganizationId: null,
      createdAt: now,
      createdByUserId: actorUserId
    };
  }

  if (role.scope === 'COMPANY') {
    if (!scopeCompanyId) throw new Error('scope_company_id_required');
    if (scopeOrganizationId) throw new Error('invalid_role_scope');
    assertCompanyExists(role.tenantId, scopeCompanyId);
    return {
      tenantId: role.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      scopeCompanyId,
      scopeOrganizationId: null,
      createdAt: now,
      createdByUserId: actorUserId
    };
  }

  if (role.scope === 'ORGANIZATION') {
    if (!scopeOrganizationId) throw new Error('scope_organization_id_required');
    if (scopeCompanyId) throw new Error('invalid_role_scope');
    assertOrganizationExists(role.tenantId, scopeOrganizationId);
    return {
      tenantId: role.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      scopeCompanyId: null,
      scopeOrganizationId,
      createdAt: now,
      createdByUserId: actorUserId
    };
  }

  throw new Error('invalid_role_scope');
}

export function listUserRoleAssignments(tenantId: UUID): UserRoleAssignment[] {
  const store = loadRegistryStore();
  return store.userRoleAssignments.filter(a => a.tenantId === tenantId);
}

export function listAssignmentsForUser(tenantId: UUID, userId: UUID): UserRoleAssignment[] {
  const store = loadRegistryStore();
  return store.userRoleAssignments.filter(a => a.tenantId === tenantId && a.userId === userId);
}

export function createUserRoleAssignment(tenantId: UUID, input: CreateUserRoleAssignmentInput): UserRoleAssignment {
  assertUserExists(tenantId, input.userId);
  const role = getRoleOrThrow(tenantId, input.roleId);

  const assignment = normalizeByRoleScope(role, input);

  const store = loadRegistryStore();
  const exists = store.userRoleAssignments.some(a => assignmentKey(tenantId, a) === assignmentKey(tenantId, assignment));
  if (exists) throw new Error('role_assignment_already_exists');

  updateRegistryStore(current => ({
    ...current,
    userRoleAssignments: [assignment, ...current.userRoleAssignments]
  }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'user_role_assignments',
    entityId: input.userId,
    after: assignment
  });

  return assignment;
}

export function removeUserRoleAssignment(
  tenantId: UUID,
  input: { userId: UUID; roleId: UUID; scopeCompanyId: UUID | null; scopeOrganizationId: UUID | null }
): void {
  const store = loadRegistryStore();

  const existing = store.userRoleAssignments.find(a => assignmentKey(tenantId, a) === assignmentKey(tenantId, input));
  if (!existing) throw new Error('role_assignment_not_found');

  updateRegistryStore(current => ({
    ...current,
    userRoleAssignments: current.userRoleAssignments.filter(a => assignmentKey(tenantId, a) !== assignmentKey(tenantId, input))
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'user_role_assignments',
    entityId: input.userId,
    before: existing,
    after: null
  });
}

