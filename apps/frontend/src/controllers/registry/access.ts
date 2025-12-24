import { loadRegistryStore } from './store';
import { Company, Role, UserCompanyMembership, UUID } from './types';

function dedupe(values: UUID[]): UUID[] {
  return Array.from(new Set(values));
}

function isActiveMembership(m: UserCompanyMembership): boolean {
  return m.status === 'ACTIVE';
}

function isActiveCompany(c: Company): boolean {
  return c.deletedAt === null;
}

function isActiveRole(r: Role): boolean {
  return r.deletedAt === null;
}

export function getAllowedCompanyIdsForUser(tenantId: UUID, userId: UUID): UUID[] {
  const store = loadRegistryStore();

  const companies = store.companies.filter(c => c.tenantId === tenantId && isActiveCompany(c));
  const roles = store.roles.filter(r => r.tenantId === tenantId && isActiveRole(r));
  const rolesById = new Map<string, Role>(roles.map(r => [r.id, r]));

  const allowed: UUID[] = [];

  store.userCompanyMemberships.forEach(m => {
    if (m.tenantId !== tenantId) return;
    if (m.userId !== userId) return;
    if (!isActiveMembership(m)) return;
    allowed.push(m.companyId);
  });

  store.userRoleAssignments.forEach(a => {
    if (a.tenantId !== tenantId) return;
    if (a.userId !== userId) return;

    const role = rolesById.get(a.roleId);
    if (!role) return;

    if (role.scope === 'TENANT') {
      companies.forEach(c => allowed.push(c.id));
      return;
    }

    if (role.scope === 'COMPANY') {
      if (a.scopeCompanyId) allowed.push(a.scopeCompanyId);
      return;
    }

    if (role.scope === 'ORGANIZATION') {
      if (!a.scopeOrganizationId) return;
      companies.forEach(c => {
        if (c.organizationId === a.scopeOrganizationId) allowed.push(c.id);
      });
    }
  });

  const activeCompanyIds = new Set(companies.map(c => c.id));
  return dedupe(allowed).filter(id => activeCompanyIds.has(id));
}

export function getDefaultCompanyIdForUser(tenantId: UUID, userId: UUID): UUID | null {
  const store = loadRegistryStore();
  const allowedCompanyIds = getAllowedCompanyIdsForUser(tenantId, userId);
  if (allowedCompanyIds.length === 0) return null;

  const defaultMembership = store.userCompanyMemberships.find(m => {
    return (
      m.tenantId === tenantId &&
      m.userId === userId &&
      isActiveMembership(m) &&
      m.isDefault &&
      allowedCompanyIds.indexOf(m.companyId) >= 0
    );
  });

  return defaultMembership ? defaultMembership.companyId : allowedCompanyIds[0];
}
