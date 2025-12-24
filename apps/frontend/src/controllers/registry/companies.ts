import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createCoaChart } from './coa';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Company, CompanyGroup, EntityStatus, UUID } from './types';

type CreateCompanyInput = {
  tradeName: string;
  code?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  organizationId?: UUID | null;
  groupIds?: UUID[];
  status?: EntityStatus;
};

type UpdateCompanyInput = {
  tradeName?: string;
  code?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  organizationId?: UUID | null;
  groupIds?: UUID[];
  status?: EntityStatus;
};

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function normalizeTaxId(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase();
}

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function dedupe(values: UUID[]): UUID[] {
  return Array.from(new Set(values));
}

export function listCompanies(tenantId: UUID): Company[] {
  const store = loadRegistryStore();
  return store.companies.filter(c => c.tenantId === tenantId && c.deletedAt === null);
}

export function createCompany(tenantId: UUID, input: CreateCompanyInput): Company {
  assertNonEmpty(input.tradeName, 'tradeName');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const code = input.code !== undefined ? input.code : null;
  const codeNormalized = code && code.trim() ? normalizeCode(code) : null;
  if (codeNormalized) {
    const exists = store.companies.some(
      c => c.tenantId === tenantId && c.deletedAt === null && c.code && normalizeCode(c.code) === codeNormalized
    );
    if (exists) throw new Error('company_code_already_exists');
  }

  const taxId = input.taxId !== undefined ? input.taxId : null;
  const taxIdNormalized = taxId && taxId.trim() ? normalizeTaxId(taxId) : null;
  if (taxIdNormalized) {
    const exists = store.companies.some(
      c =>
        c.tenantId === tenantId &&
        c.deletedAt === null &&
        c.taxId &&
        normalizeTaxId(c.taxId) === taxIdNormalized
    );
    if (exists) throw new Error('company_tax_id_already_exists');
  }

  const organizationId = input.organizationId !== undefined ? input.organizationId : null;
  if (organizationId) {
    const orgExists = store.organizations.some(
      o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null
    );
    if (!orgExists) throw new Error('organization_not_found');
  }

  const groupIds = dedupe(input.groupIds !== undefined ? input.groupIds : []);
  if (groupIds.length > 0) {
    const groups = store.groups.filter(g => g.tenantId === tenantId && g.deletedAt === null);
    const valid = new Set(groups.map(g => g.id));
    const invalid = groupIds.find(id => !valid.has(id));
    if (invalid) throw new Error('group_not_found');
  }

  const company: Company = {
    id: createUuid(),
    tenantId,
    organizationId,
    code: code && code.trim() ? code.trim() : null,
    legalName: input.legalName !== undefined ? input.legalName : null,
    tradeName: input.tradeName.trim(),
    taxId: taxId && taxId.trim() ? taxId.trim() : null,
    status: input.status || 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  const companyGroups: CompanyGroup[] = groupIds.map(groupId => ({
    tenantId,
    companyId: company.id,
    groupId,
    createdAt: now,
    createdByUserId: actorUserId
  }));

  updateRegistryStore(current => ({
    ...current,
    ui: { ...current.ui, currentCompanyId: company.id },
    companies: [company, ...current.companies],
    companyGroups: [...companyGroups, ...current.companyGroups]
  }));

  logAuditEvent({
    tenantId,
    companyId: company.id,
    action: 'CREATE',
    entityType: 'companies',
    entityId: company.id,
    after: company
  });
  createCoaChart(tenantId, {
    name: `Plano - ${company.tradeName}`,
    scope: 'COMPANY',
    companyId: company.id,
    isDefault: true
  });

  return company;
}

export function updateCompany(tenantId: UUID, companyId: UUID, patch: UpdateCompanyInput): Company {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.companies.find(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!existing) throw new Error('company_not_found');

  const now = nowIso();
  const nextCode = patch.code !== undefined ? patch.code : existing.code;
  const nextCodeNormalized = nextCode && nextCode.trim() ? normalizeCode(nextCode) : null;
  if (nextCodeNormalized) {
    const exists = store.companies.some(
      c =>
        c.tenantId === tenantId &&
        c.deletedAt === null &&
        c.id !== companyId &&
        c.code &&
        normalizeCode(c.code) === nextCodeNormalized
    );
    if (exists) throw new Error('company_code_already_exists');
  }

  const nextTaxId = patch.taxId !== undefined ? patch.taxId : existing.taxId;
  const nextTaxIdNormalized = nextTaxId && nextTaxId.trim() ? normalizeTaxId(nextTaxId) : null;
  if (nextTaxIdNormalized) {
    const exists = store.companies.some(
      c =>
        c.tenantId === tenantId &&
        c.deletedAt === null &&
        c.id !== companyId &&
        c.taxId &&
        normalizeTaxId(c.taxId) === nextTaxIdNormalized
    );
    if (exists) throw new Error('company_tax_id_already_exists');
  }

  const nextOrganizationId =
    patch.organizationId !== undefined ? patch.organizationId : existing.organizationId;
  if (nextOrganizationId) {
    const orgExists = store.organizations.some(
      o => o.tenantId === tenantId && o.id === nextOrganizationId && o.deletedAt === null
    );
    if (!orgExists) throw new Error('organization_not_found');
  }

  const nextGroupIds = patch.groupIds !== undefined ? dedupe(patch.groupIds) : [];
  if (nextGroupIds.length > 0) {
    const groups = store.groups.filter(g => g.tenantId === tenantId && g.deletedAt === null);
    const valid = new Set(groups.map(g => g.id));
    const invalid = nextGroupIds.find(id => !valid.has(id));
    if (invalid) throw new Error('group_not_found');
  }

  const updated: Company = {
    ...existing,
    organizationId: nextOrganizationId ? nextOrganizationId : null,
    code: nextCode && nextCode.trim() ? nextCode.trim() : null,
    tradeName: patch.tradeName !== undefined ? patch.tradeName.trim() : existing.tradeName,
    legalName: patch.legalName !== undefined ? patch.legalName : existing.legalName,
    taxId: nextTaxId && nextTaxId.trim() ? nextTaxId.trim() : null,
    status: patch.status !== undefined ? patch.status : existing.status,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.tradeName, 'tradeName');

  updateRegistryStore(current => ({
    ...current,
    companies: current.companies.map(c => (c.id === companyId ? updated : c)),
    companyGroups:
      patch.groupIds !== undefined
        ? [
            ...current.companyGroups.filter(cg => !(cg.tenantId === tenantId && cg.companyId === companyId)),
            ...nextGroupIds.map(groupId => ({
              tenantId,
              companyId,
              groupId,
              createdAt: now,
              createdByUserId: actorUserId
            }))
          ]
        : current.companyGroups
  }));

  logAuditEvent({
    tenantId,
    companyId,
    action: 'UPDATE',
    entityType: 'companies',
    entityId: companyId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteCompany(tenantId: UUID, companyId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.companies.find(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!existing) throw new Error('company_not_found');

  const now = nowIso();
  const deleted: Company = {
    ...existing,
    status: 'INACTIVE',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  const chartIdsForCompany = store.coaCharts
    .filter(c => c.tenantId === tenantId && c.companyId === companyId && c.deletedAt === null)
    .map(c => c.id);

  updateRegistryStore(current => ({
    ...current,
    companies: current.companies.map(c => (c.id === companyId ? deleted : c)),
    companyGroups: current.companyGroups.filter(cg => !(cg.tenantId === tenantId && cg.companyId === companyId)),
    customerCompanyAccess: current.customerCompanyAccess.filter(
      a => !(a.tenantId === tenantId && a.companyId === companyId)
    ),
    supplierCompanyAccess: current.supplierCompanyAccess.filter(
      a => !(a.tenantId === tenantId && a.companyId === companyId)
    ),
    financeSettlements: current.financeSettlements.filter(
      s => !(s.tenantId === tenantId && s.companyId === companyId)
    ),
    financeTitles: current.financeTitles.map(t =>
      t.tenantId === tenantId && t.companyId === companyId
        ? { ...t, status: 'CANCELED', deletedAt: now, updatedAt: now, updatedByUserId: actorUserId }
        : t
    ),
    userCompanyMemberships: current.userCompanyMemberships.filter(
      m => !(m.tenantId === tenantId && m.companyId === companyId)
    ),
    userRoleAssignments: current.userRoleAssignments.filter(
      a => !(a.tenantId === tenantId && a.scopeCompanyId === companyId)
    ),
    employees: current.employees.map(e =>
      e.tenantId === tenantId && e.companyId === companyId
        ? { ...e, status: 'INACTIVE', deletedAt: now, updatedAt: now, updatedByUserId: actorUserId }
        : e
    ),
    coaCharts: current.coaCharts.map(c =>
      c.tenantId === tenantId && c.companyId === companyId
        ? { ...c, deletedAt: now, updatedAt: now, updatedByUserId: actorUserId }
        : c
    ),
    coaAccounts: current.coaAccounts.map(a =>
      a.tenantId === tenantId && chartIdsForCompany.includes(a.chartId)
        ? { ...a, deletedAt: now, updatedAt: now, updatedByUserId: actorUserId }
        : a
    ),
    ui: {
      ...current.ui,
      currentCompanyId: current.ui.currentCompanyId === companyId ? null : current.ui.currentCompanyId
    }
  }));

  logAuditEvent({
    tenantId,
    companyId,
    action: 'DELETE',
    entityType: 'companies',
    entityId: companyId,
    before: existing,
    after: deleted
  });
}
