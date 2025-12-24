import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import {
  CodeSequence,
  CodeTemplate,
  CodeTemplateTarget,
  CoaAccount,
  CoaAccountKind,
  CoaChart,
  CoaChartScope,
  Company,
  EntityStatus,
  Organization,
  UUID
} from './types';

type CreateCoaChartInput = {
  name: string;
  scope: CoaChartScope;
  organizationId?: UUID | null;
  companyId?: UUID | null;
  isDefault?: boolean;
};

type UpdateCoaChartInput = Partial<CreateCoaChartInput>;

type CreateCoaAccountInput = {
  chartId: UUID;
  parentAccountId?: UUID | null;
  code: string;
  name: string;
  type: CoaAccountKind;
  isPostable?: boolean;
  status?: EntityStatus;
  meta?: Record<string, unknown> | null;
};

type UpdateCoaAccountInput = Partial<CreateCoaAccountInput>;

type CreateCodeTemplateInput = {
  name: string;
  target: CodeTemplateTarget;
  pattern: string;
  exampleOutput?: string | null;
};

type UpdateCodeTemplateInput = Partial<CreateCodeTemplateInput>;

type GenerateCodeOptions = {
  templateId: UUID;
  scopeCompanyId?: UUID | null;
  scopeOrganizationId?: UUID | null;
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function ensureOrganization(tenantId: UUID, organizationId: UUID | null): Organization {
  const store = loadRegistryStore();
  const organization = store.organizations.find(o => o.tenantId === tenantId && o.id === organizationId && o.deletedAt === null);
  if (!organization) throw new Error('organization_not_found');
  return organization;
}

function ensureCompany(tenantId: UUID, companyId: UUID): Company {
  const store = loadRegistryStore();
  const company = store.companies.find(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!company) throw new Error('company_not_found');
  return company;
}

function isSameScope(chart: CoaChart, scope: CoaChartScope, organizationId: UUID | null, companyId: UUID | null): boolean {
  if (chart.scope !== scope) return false;
  if (scope === 'TENANT') return true;
  if (scope === 'ORGANIZATION') return chart.organizationId === organizationId;
  return scope === 'COMPANY' ? chart.companyId === companyId : false;
}

function updateDefaultChart(
  tenantId: UUID,
  scope: CoaChartScope,
  organizationId: UUID | null,
  companyId: UUID | null,
  newDefaultId: UUID
): void {
  updateRegistryStore(store => ({
    ...store,
    coaCharts: store.coaCharts.map(chart =>
      chart.tenantId === tenantId && isSameScope(chart, scope, organizationId, companyId)
        ? { ...chart, isDefault: chart.id === newDefaultId }
        : chart
    )
  }));
}

function ensureChartActive(store: ReturnType<typeof loadRegistryStore>, chartId: UUID): CoaChart {
  const chart = store.coaCharts.find(c => c.id === chartId && c.deletedAt === null);
  if (!chart) throw new Error('coa_chart_not_found');
  return chart;
}

function assertParentInChart(parentId: UUID | null, chartId: UUID): void {
  if (!parentId) return;
  const store = loadRegistryStore();
  const parent = store.coaAccounts.find(a => a.id === parentId && a.chartId === chartId && a.deletedAt === null);
  if (!parent) throw new Error('coa_parent_not_found');
}

function assertUniqueCodeWithinChart(chartId: UUID, code: string, exceptId?: UUID): void {
  const normalized = normalizeCode(code);
  const store = loadRegistryStore();
  const exists = store.coaAccounts.some(
    a =>
      a.chartId === chartId &&
      a.deletedAt === null &&
      normalizeCode(a.code) === normalized &&
      a.id !== exceptId
  );
  if (exists) throw new Error('coa_code_already_exists');
}

export function listCoaCharts(tenantId: UUID): CoaChart[] {
  const store = loadRegistryStore();
  return store.coaCharts.filter(c => c.tenantId === tenantId && c.deletedAt === null);
}

export function createCoaChart(tenantId: UUID, input: CreateCoaChartInput): CoaChart {
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const organizationId = input.organizationId !== undefined ? input.organizationId : null;
  const companyId = input.companyId !== undefined ? input.companyId : null;

  if (input.scope === 'ORGANIZATION' && !organizationId) throw new Error('organization_id_required');
  if (input.scope === 'COMPANY' && !companyId) throw new Error('company_id_required');

  if (organizationId) ensureOrganization(tenantId, organizationId);
  if (companyId) ensureCompany(tenantId, companyId);

  const chart: CoaChart = {
    id: createUuid(),
    tenantId,
    name: input.name.trim(),
    scope: input.scope,
    organizationId,
    companyId,
    isDefault: !!input.isDefault,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaCharts: [chart, ...current.coaCharts]
  }));

  if (chart.isDefault) updateDefaultChart(tenantId, chart.scope, chart.organizationId, chart.companyId, chart.id);

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'coa_charts',
    entityId: chart.id,
    after: chart
  });

  return chart;
}

export function updateCoaChart(tenantId: UUID, chartId: UUID, patch: UpdateCoaChartInput): CoaChart {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.coaCharts.find(c => c.tenantId === tenantId && c.id === chartId && c.deletedAt === null);
  if (!existing) throw new Error('coa_chart_not_found');

  const organizationId =
    patch.organizationId !== undefined ? patch.organizationId : existing.organizationId;
  const companyId = patch.companyId !== undefined ? patch.companyId : existing.companyId;

  if (existing.scope === 'ORGANIZATION' && organizationId && organizationId !== existing.organizationId) {
    ensureOrganization(tenantId, organizationId);
  }
  if (existing.scope === 'COMPANY' && companyId && companyId !== existing.companyId) {
    ensureCompany(tenantId, companyId);
  }

  const updated: CoaChart = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    organizationId,
    companyId,
    isDefault: patch.isDefault !== undefined ? patch.isDefault : existing.isDefault,
    updatedAt: nowIso(),
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaCharts: current.coaCharts.map(c => (c.id === chartId ? updated : c))
  }));

  if (updated.isDefault) updateDefaultChart(tenantId, updated.scope, updated.organizationId, updated.companyId, updated.id);

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'coa_charts',
    entityId: chartId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteCoaChart(tenantId: UUID, chartId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.coaCharts.find(c => c.tenantId === tenantId && c.id === chartId && c.deletedAt === null);
  if (!existing) throw new Error('coa_chart_not_found');

  const now = nowIso();
  const deleted: CoaChart = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaCharts: current.coaCharts.map(c => (c.id === chartId ? deleted : c)),
    coaAccounts: current.coaAccounts.filter(a => a.chartId !== chartId)
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'coa_charts',
    entityId: chartId,
    before: existing,
    after: deleted
  });
}

export function getDefaultChartForCompany(tenantId: UUID, companyId: UUID | null): CoaChart | null {
  const store = loadRegistryStore();

  const company = companyId ? store.companies.find(c => c.id === companyId && c.tenantId === tenantId) : null;
  const orgId = company && company.organizationId ? company.organizationId : null;

  const pref = store.coaCharts.find(c => c.tenantId === tenantId && c.scope === 'COMPANY' && c.companyId === companyId && c.isDefault && c.deletedAt === null);
  if (pref) return pref;

  const orgChart = store.coaCharts.find(
    c => c.tenantId === tenantId && c.scope === 'ORGANIZATION' && c.organizationId === orgId && c.isDefault && c.deletedAt === null
  );
  if (orgChart) return orgChart;

  const tenantChart = store.coaCharts.find(c => c.tenantId === tenantId && c.scope === 'TENANT' && c.isDefault && c.deletedAt === null);
  return tenantChart || null;
}

export function listCoaAccounts(tenantId: UUID, chartId: UUID): CoaAccount[] {
  const store = loadRegistryStore();
  return store.coaAccounts.filter(a => a.tenantId === tenantId && a.chartId === chartId && a.deletedAt === null);
}

export function createCoaAccount(tenantId: UUID, input: CreateCoaAccountInput): CoaAccount {
  assertNonEmpty(input.code, 'code');
  assertNonEmpty(input.name, 'name');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const chart = ensureChartActive(store, input.chartId);
  const parentAccountId =
    input.parentAccountId !== undefined && input.parentAccountId !== null ? input.parentAccountId : null;
  assertParentInChart(parentAccountId, chart.id);
  assertUniqueCodeWithinChart(chart.id, input.code);

  const account: CoaAccount = {
    id: createUuid(),
    tenantId,
    companyId: chart.companyId !== undefined ? chart.companyId : null,
    chartId: chart.id,
    parentAccountId: input.parentAccountId !== undefined ? input.parentAccountId : null,
    code: input.code.trim(),
    codeNormalized: normalizeCode(input.code),
    name: input.name.trim(),
    type: input.type,
    isPostable: input.isPostable !== undefined ? input.isPostable : true,
    status: input.status || 'ACTIVE',
    meta: input.meta !== undefined ? input.meta : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaAccounts: [account, ...current.coaAccounts]
  }));

  logAuditEvent({
    tenantId,
    entityType: 'coa_accounts',
    action: 'CREATE',
    entityId: account.id,
    after: account
  });

  return account;
}

export function updateCoaAccount(tenantId: UUID, accountId: UUID, patch: UpdateCoaAccountInput): CoaAccount {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.coaAccounts.find(a => a.tenantId === tenantId && a.id === accountId && a.deletedAt === null);
  if (!existing) throw new Error('coa_account_not_found');

  const chart = ensureChartActive(store, existing.chartId);
  if (patch.parentAccountId !== undefined) assertParentInChart(patch.parentAccountId, chart.id);
  if (patch.code !== undefined) assertUniqueCodeWithinChart(chart.id, patch.code, accountId);

  const updated: CoaAccount = {
    ...existing,
    parentAccountId: patch.parentAccountId !== undefined ? patch.parentAccountId : existing.parentAccountId,
    code: patch.code !== undefined ? patch.code.trim() : existing.code,
    codeNormalized: patch.code !== undefined ? normalizeCode(patch.code) : existing.codeNormalized,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    type: patch.type !== undefined ? patch.type : existing.type,
    isPostable: patch.isPostable !== undefined ? patch.isPostable : existing.isPostable,
    status: patch.status !== undefined ? patch.status : existing.status,
    meta: patch.meta !== undefined ? patch.meta : existing.meta,
    updatedAt: nowIso(),
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaAccounts: current.coaAccounts.map(a => (a.id === accountId ? updated : a))
  }));

  logAuditEvent({
    tenantId,
    entityType: 'coa_accounts',
    action: 'UPDATE',
    entityId: accountId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteCoaAccount(tenantId: UUID, accountId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.coaAccounts.find(a => a.tenantId === tenantId && a.id === accountId && a.deletedAt === null);
  if (!existing) throw new Error('coa_account_not_found');

  const now = nowIso();
  const deleted: CoaAccount = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    coaAccounts: current.coaAccounts.map(a => (a.id === accountId ? deleted : a))
  }));

  logAuditEvent({
    tenantId,
    entityType: 'coa_accounts',
    action: 'DELETE',
    entityId: accountId,
    before: existing,
    after: deleted
  });
}

export function listCodeTemplates(tenantId: UUID): CodeTemplate[] {
  const store = loadRegistryStore();
  return store.codeTemplates.filter(t => t.tenantId === tenantId && t.deletedAt === null);
}

export function createCodeTemplate(tenantId: UUID, input: CreateCodeTemplateInput): CodeTemplate {
  assertNonEmpty(input.name, 'name');
  assertNonEmpty(input.pattern, 'pattern');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const template: CodeTemplate = {
    id: createUuid(),
    tenantId,
    target: input.target,
    name: input.name.trim(),
    pattern: input.pattern.trim(),
    exampleOutput: input.exampleOutput !== undefined ? input.exampleOutput : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, codeTemplates: [template, ...current.codeTemplates] }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'code_templates',
    entityId: template.id,
    after: template
  });

  return template;
}

export function updateCodeTemplate(tenantId: UUID, templateId: UUID, patch: UpdateCodeTemplateInput): CodeTemplate {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.codeTemplates.find(t => t.tenantId === tenantId && t.id === templateId && t.deletedAt === null);
  if (!existing) throw new Error('code_template_not_found');

  const updated: CodeTemplate = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    pattern: patch.pattern !== undefined ? patch.pattern.trim() : existing.pattern,
    exampleOutput: patch.exampleOutput !== undefined ? patch.exampleOutput : existing.exampleOutput,
    updatedAt: nowIso(),
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    codeTemplates: current.codeTemplates.map(t => (t.id === templateId ? updated : t))
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'code_templates',
    entityId: templateId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteCodeTemplate(tenantId: UUID, templateId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.codeTemplates.find(t => t.tenantId === tenantId && t.id === templateId && t.deletedAt === null);
  if (!existing) throw new Error('code_template_not_found');

  const now = nowIso();
  const deleted: CodeTemplate = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({ ...current, codeTemplates: current.codeTemplates.map(t => (t.id === templateId ? deleted : t)) }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'code_templates',
    entityId: templateId,
    before: existing,
    after: deleted
  });
}

function padSequence(value: number, digits: number): string {
  const str = value.toString();
  return str.padStart(digits, '0');
}

function findSequence(
  sequences: CodeSequence[],
  templateId: UUID,
  scopeCompanyId?: UUID | null,
  scopeOrganizationId?: UUID | null
): CodeSequence | null {
  if (scopeCompanyId) {
    const match = sequences.find(
      s =>
        s.templateId === templateId &&
        s.scopeCompanyId === scopeCompanyId &&
        s.scopeOrganizationId === null
    );
    if (match) return match;
  }
  if (scopeOrganizationId) {
    const match = sequences.find(
      s =>
        s.templateId === templateId &&
        s.scopeOrganizationId === scopeOrganizationId &&
        s.scopeCompanyId === null
    );
    if (match) return match;
  }
  const tenantMatch = sequences.find(
    s =>
      s.templateId === templateId &&
      s.scopeCompanyId === null &&
      s.scopeOrganizationId === null
  );
  return tenantMatch || null;
}

function incrementSequenceValue(
  tenantId: UUID,
  templateId: UUID,
  scopeCompanyId?: UUID | null,
  scopeOrganizationId?: UUID | null
): CodeSequence {
  let result: CodeSequence | null = null;

  updateRegistryStore(store => {
    const sequences = store.codeSequences.filter(s => s.tenantId === tenantId);
    let sequence = findSequence(sequences, templateId, scopeCompanyId, scopeOrganizationId);
    if (!sequence) {
      sequence = {
        id: createUuid(),
        tenantId,
        templateId,
        scopeCompanyId: scopeCompanyId || null,
        scopeOrganizationId: scopeOrganizationId || null,
        currentValue: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdByUserId: store.ui.currentUserId,
        updatedByUserId: store.ui.currentUserId
      };
    }

    const nextValue = sequence.currentValue + 1;
    const updated: CodeSequence = {
      ...sequence,
      currentValue: nextValue,
      updatedAt: nowIso(),
      updatedByUserId: store.ui.currentUserId
    };

    const filtered = store.codeSequences.filter(s => s.id !== sequence!.id);
    result = updated;

    return {
      ...store,
      codeSequences: [updated, ...filtered]
    };
  });

  if (!result) throw new Error('sequence_error');
  return result;
}

function renderPlaceholder(
  placeholder: string,
  template: CodeTemplate,
  options: GenerateCodeOptions,
  context: { organizationCode: string | null; companyCode: string | null },
  seqCache: { value: number | null }
): string {
  const parts = placeholder.split(':');
  const key = parts[0];
  const param = parts[1];

  if (key === 'org.code') {
    return context.organizationCode || '';
  }
  if (key === 'company.code') {
    return context.companyCode || '';
  }
  if (key === 'static') {
    return param || '';
  }
  if (key === 'seq') {
    const digits = param ? Number(param) : 0;
    if (seqCache.value === null) {
      const sequence = incrementSequenceValue(
        template.tenantId,
        template.id,
        options.scopeCompanyId,
        options.scopeOrganizationId
      );
      seqCache.value = sequence.currentValue;
    }
    return digits > 0 ? padSequence(seqCache.value, digits) : seqCache.value.toString();
  }

  return '';
}

export function generateCodeFromTemplate(tenantId: UUID, options: GenerateCodeOptions): string {
  const store = loadRegistryStore();
  const template = store.codeTemplates.find(t => t.tenantId === tenantId && t.id === options.templateId && t.deletedAt === null);
  if (!template) throw new Error('code_template_not_found');

  const company =
    options.scopeCompanyId && store.companies.some(c => c.tenantId === tenantId && c.id === options.scopeCompanyId)
      ? store.companies.find(c => c.id === options.scopeCompanyId)
      : null;
  const companyCode = company && company.code ? company.code : null;

  const organization =
    options.scopeOrganizationId &&
    store.organizations.some(o => o.tenantId === tenantId && o.id === options.scopeOrganizationId)
      ? store.organizations.find(o => o.id === options.scopeOrganizationId)
      : null;
  const organizationCode = organization && organization.code ? organization.code : null;

  const seqCache = { value: null as number | null };

  return template.pattern.replace(/{{\s*([^}]+)\s*}}/g, (_match, placeholder) =>
    renderPlaceholder(placeholder, template, options, { companyCode, organizationCode }, seqCache)
  );
}

export function listCodeSequences(tenantId: UUID): CodeSequence[] {
  const store = loadRegistryStore();
  return store.codeSequences.filter(s => s.tenantId === tenantId);
}
