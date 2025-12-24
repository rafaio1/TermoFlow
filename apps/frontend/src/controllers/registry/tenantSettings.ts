import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { loadRegistryStore, updateRegistryStore } from './store';
import { TenantSettings, UUID } from './types';

type UpdateTenantSettingsInput = {
  useOrganizations?: boolean;
  useGroups?: boolean;
};

export function getTenantSettings(tenantId: UUID): TenantSettings {
  const store = loadRegistryStore();
  const existing = store.tenantSettings.find(s => s.tenantId === tenantId);
  if (existing) return existing;

  const now = nowIso();
  const actorUserId = store.ui.currentUserId;
  const created: TenantSettings = {
    tenantId,
    useOrganizations: false,
    useGroups: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, tenantSettings: [created, ...current.tenantSettings] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'tenant_settings',
    entityId: tenantId,
    after: created
  });

  return created;
}

export function updateTenantSettings(tenantId: UUID, patch: UpdateTenantSettingsInput): TenantSettings {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.tenantSettings.find(s => s.tenantId === tenantId) || getTenantSettings(tenantId);

  const now = nowIso();
  const updated: TenantSettings = {
    ...existing,
    useOrganizations: patch.useOrganizations !== undefined ? patch.useOrganizations : existing.useOrganizations,
    useGroups: patch.useGroups !== undefined ? patch.useGroups : existing.useGroups,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => {
    const organizationsDisabled = existing.useOrganizations && !updated.useOrganizations;
    const groupsDisabled = existing.useGroups && !updated.useGroups;

    let companies = current.companies;
    let groups = current.groups;
    let companyGroups = current.companyGroups;

    if (groupsDisabled) {
      companyGroups = companyGroups.filter(cg => cg.tenantId !== tenantId);
    }

    if (organizationsDisabled) {
      companies = companies.map(c => (c.tenantId === tenantId ? { ...c, organizationId: null } : c));
      groups = groups.map(g => (g.tenantId === tenantId ? { ...g, organizationId: null } : g));
    }

    return {
      ...current,
      tenantSettings: current.tenantSettings.map(s => (s.tenantId === tenantId ? updated : s)),
      companies,
      groups,
      companyGroups
    };
  });

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'tenant_settings',
    entityId: tenantId,
    before: existing,
    after: updated
  });

  return updated;
}
