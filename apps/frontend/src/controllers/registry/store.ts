import { createUuid } from './uuid';
import { nowIso } from './time';
import {
  CoaAccount,
  CoaChart,
  CodeSequence,
  CodeTemplate,
  Company,
  CompanyGroup,
  Customer,
  CustomerCompanyAccess,
  Employee,
  FinanceSettlement,
  FinanceTitle,
  Group,
  JobFunction,
  Organization,
  Permission,
  Role,
  RolePermission,
  RegistryStore,
  Supplier,
  SupplierCompanyAccess,
  Tenant,
  TenantSettings,
  User,
  UserCompanyMembership,
  UserRoleAssignment,
  UUID
} from './types';

const STORAGE_KEY = 'termoflow.registry.v1';

let memoryStoreJson: string | null = null;

type PermissionSeed = { key: string; description: string };

const DEFAULT_PERMISSIONS: PermissionSeed[] = [
  { key: 'registry.tenants.read', description: 'Listar tenants' },
  { key: 'registry.tenants.write', description: 'Criar/editar/remover tenants' },
  { key: 'registry.organizations.read', description: 'Listar organizações' },
  { key: 'registry.organizations.write', description: 'Criar/editar/remover organizações' },
  { key: 'registry.groups.read', description: 'Listar grupos' },
  { key: 'registry.groups.write', description: 'Criar/editar/remover grupos' },
  { key: 'registry.companies.read', description: 'Listar empresas' },
  { key: 'registry.companies.write', description: 'Criar/editar/remover empresas' },
  { key: 'registry.job_functions.read', description: 'Listar cargos' },
  { key: 'registry.job_functions.write', description: 'Criar/editar/remover cargos' },
  { key: 'registry.employees.read', description: 'Listar funcionários' },
  { key: 'registry.employees.write', description: 'Criar/editar/remover funcionários' },
  { key: 'registry.coa.read', description: 'Consultar plano de contas (COA)' },
  { key: 'registry.coa.write', description: 'Editar plano de contas (COA)' },
  { key: 'registry.audit.read', description: 'Consultar auditoria' },
  { key: 'customers.read', description: 'Listar clientes' },
  { key: 'customers.write', description: 'Criar/editar/remover clientes' },
  { key: 'suppliers.read', description: 'Listar fornecedores' },
  { key: 'suppliers.write', description: 'Criar/editar/remover fornecedores' },
  { key: 'finance.ap.read', description: 'Listar contas a pagar (AP)' },
  { key: 'finance.ap.write', description: 'Criar/editar/remover contas a pagar (AP)' },
  { key: 'finance.ar.read', description: 'Listar contas a receber (AR)' },
  { key: 'finance.ar.write', description: 'Criar/editar/remover contas a receber (AR)' },
  { key: 'rbac.users.read', description: 'Listar usuários' },
  { key: 'rbac.users.write', description: 'Criar/editar/remover usuários' },
  { key: 'rbac.roles.read', description: 'Listar roles' },
  { key: 'rbac.roles.write', description: 'Criar/editar/remover roles' },
  { key: 'rbac.permissions.read', description: 'Consultar catálogo de permissões' }
];

function normalizePermissionKey(key: string): string {
  return key.trim().toLowerCase();
}

function ensurePermissionsCatalog(existing: Permission[]): Permission[] {
  const byKey = new Map<string, Permission>();

  existing.forEach(p => {
    if (!p || typeof p !== 'object') return;
    const key = typeof p.key === 'string' ? normalizePermissionKey(p.key) : '';
    if (!key) return;
    if (byKey.has(key)) return;
    byKey.set(key, {
      id: typeof p.id === 'string' && p.id ? p.id : createUuid(),
      key,
      description: typeof p.description === 'string' ? p.description : ''
    });
  });

  DEFAULT_PERMISSIONS.forEach(seed => {
    const key = normalizePermissionKey(seed.key);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { id: createUuid(), key, description: seed.description });
      return;
    }
    if (!current.description && seed.description) {
      byKey.set(key, { ...current, description: seed.description });
    }
  });

  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function ensureSystemAdminRoleHasAllPermissions(store: RegistryStore): RegistryStore {
  const allPermissionIds = store.permissions.map(p => p.id);
  if (allPermissionIds.length === 0) return store;

  const existingByTenantAndRole = new Map<string, Set<string>>();
  store.rolePermissions.forEach(rp => {
    const key = `${rp.tenantId}:${rp.roleId}`;
    const set = existingByTenantAndRole.get(key) || new Set<string>();
    set.add(rp.permissionId);
    existingByTenantAndRole.set(key, set);
  });

  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const extra: RolePermission[] = [];
  store.roles.forEach(role => {
    if (!role || typeof role !== 'object') return;
    if (!role.isSystem) return;
    if (role.deletedAt !== null) return;
    if (role.name.trim().toLowerCase() !== 'admin') return;

    const key = `${role.tenantId}:${role.id}`;
    const existing = existingByTenantAndRole.get(key) || new Set<string>();
    allPermissionIds.forEach(permissionId => {
      if (existing.has(permissionId)) return;
      extra.push({
        tenantId: role.tenantId,
        roleId: role.id,
        permissionId,
        createdAt: now,
        createdByUserId: actorUserId
      });
    });
  });

  if (extra.length === 0) return store;
  return { ...store, rolePermissions: [...store.rolePermissions, ...extra] };
}

function normalizeCoaCode(code: string): string {
  return code.trim().toLowerCase();
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (_err) {
    return false;
  }
}

function readRaw(): string | null {
  if (hasLocalStorage()) {
    return window.localStorage.getItem(STORAGE_KEY);
  }
  return memoryStoreJson;
}

function writeRaw(value: string): void {
  if (hasLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  memoryStoreJson = value;
}

function emitContextUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent('termoflow:context-updated'));
  } catch (_err) {
    // ignore
  }
}

function createEmptyStore(): RegistryStore {
  return {
    version: 1,
    ui: {
      currentTenantId: null,
      currentCompanyId: null,
      currentUserId: null
    },
    tenants: [],
    tenantSettings: [],
    organizations: [],
    groups: [],
    companies: [],
    companyGroups: [],
    users: [],
    roles: [],
    permissions: [],
    rolePermissions: [],
    userCompanyMemberships: [],
    userRoleAssignments: [],
    jobFunctions: [],
    employees: [],
    customers: [],
    customerCompanyAccess: [],
    suppliers: [],
    supplierCompanyAccess: [],
    financeTitles: [],
    financeSettlements: [],
    coaCharts: [],
    coaAccounts: [],
    codeTemplates: [],
    codeSequences: [],
    auditLogs: []
  };
}

function normalizeStore(candidate: any): RegistryStore {
  if (!candidate || typeof candidate !== 'object') return createEmptyStore();
  if (candidate.version !== 1) return createEmptyStore();

  const now = nowIso();

  const companiesRaw = Array.isArray(candidate.companies) ? candidate.companies : [];
  const companies: Company[] = companiesRaw.map((c: any) => {
    const tradeNameRaw = c.tradeName != null ? c.tradeName : c.name != null ? c.name : '';
    const tradeNameValue = typeof tradeNameRaw === 'string' ? tradeNameRaw.trim() : '';

    const taxIdRaw = c.taxId != null ? c.taxId : c.documentNumber != null ? c.documentNumber : null;
    const taxIdValue = typeof taxIdRaw === 'string' ? taxIdRaw.trim() : null;

    const legalNameRaw = c.legalName;
    const legalNameValue = typeof legalNameRaw === 'string' ? legalNameRaw : null;

    return {
      ...c,
      tradeName: tradeNameValue || 'Empresa sem nome',
      taxId: taxIdValue,
      legalName: legalNameValue
    };
  });

  const companyGroupsRaw = Array.isArray(candidate.companyGroups) ? candidate.companyGroups : [];
  let companyGroups: CompanyGroup[] = companyGroupsRaw.map((cg: any) => ({
    ...cg,
    createdAt: cg.createdAt != null ? cg.createdAt : now,
    createdByUserId: cg.createdByUserId != null ? cg.createdByUserId : null
  }));

  // Migração: versões antigas guardavam `groupIds` dentro de `companies`.
  if (companyGroups.length === 0) {
    const next: CompanyGroup[] = [];
    companiesRaw.forEach((c: any) => {
      const groupIds: any[] = Array.isArray(c.groupIds) ? c.groupIds : [];
      groupIds.forEach(groupId => {
        if (!c.tenantId || !c.id || !groupId) return;
        next.push({
          tenantId: c.tenantId,
          companyId: c.id,
          groupId,
          createdAt: c.createdAt != null ? c.createdAt : now,
          createdByUserId: c.createdByUserId != null ? c.createdByUserId : null
        });
      });
    });
    const seen = new Set<string>();
    companyGroups = next.filter(cg => {
      const key = `${cg.tenantId}:${cg.companyId}:${cg.groupId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const ui: any = candidate && typeof candidate.ui === 'object' ? candidate.ui : null;

  const userCompanyMembershipsRaw = Array.isArray(candidate.userCompanyMemberships)
    ? candidate.userCompanyMemberships
    : [];
  const userCompanyMemberships: UserCompanyMembership[] = userCompanyMembershipsRaw.map((m: any) => ({
    ...m,
    status: m && m.status ? m.status : 'ACTIVE',
    isDefault: !!(m && m.isDefault),
    createdAt: m && m.createdAt ? m.createdAt : now,
    updatedAt: m && m.updatedAt ? m.updatedAt : now,
    createdByUserId: m && m.createdByUserId ? m.createdByUserId : null,
    updatedByUserId: m && m.updatedByUserId ? m.updatedByUserId : null
  }));

  const userRoleAssignmentsRaw = Array.isArray(candidate.userRoleAssignments) ? candidate.userRoleAssignments : [];
  const userRoleAssignments: UserRoleAssignment[] = userRoleAssignmentsRaw.map((a: any) => ({
    ...a,
    scopeCompanyId: a && a.scopeCompanyId ? a.scopeCompanyId : null,
    scopeOrganizationId: a && a.scopeOrganizationId ? a.scopeOrganizationId : null,
    createdAt: a && a.createdAt ? a.createdAt : now,
    createdByUserId: a && a.createdByUserId ? a.createdByUserId : null
  }));

  const actorUserId = ui && ui.currentUserId != null ? ui.currentUserId : null;

  const coaChartsRaw = Array.isArray(candidate.coaCharts) ? candidate.coaCharts : [];
  const coaAccountsRaw = Array.isArray(candidate.coaAccounts) ? candidate.coaAccounts : [];
  const codeTemplatesRaw = Array.isArray(candidate.codeTemplates) ? candidate.codeTemplates : [];
  const codeSequencesRaw = Array.isArray(candidate.codeSequences) ? candidate.codeSequences : [];

  let coaCharts: CoaChart[] = coaChartsRaw as CoaChart[];
  let coaAccounts: CoaAccount[] = [];

  // Migração: COA antigo era amarrado em company_id (sem charts).
  const legacyAccountsDetected =
    coaChartsRaw.length === 0 &&
    coaAccountsRaw.some((a: any) => a && typeof a === 'object' && a.companyId != null);

  if (legacyAccountsDetected) {
    const chartByCompanyKey = new Map<string, string>();
    const nextCharts: CoaChart[] = [];

    companies.forEach(c => {
      if (!c || typeof c !== 'object') return;
      if (!c.tenantId || !c.id) return;
      const key = `${c.tenantId}:${c.id}`;
      if (chartByCompanyKey.has(key)) return;

      const chartId = createUuid();
      chartByCompanyKey.set(key, chartId);

      nextCharts.push({
        id: chartId,
        tenantId: c.tenantId,
        name: `Plano - ${c.tradeName || 'Empresa'}`,
        scope: 'COMPANY',
        organizationId: c.organizationId ? c.organizationId : null,
        companyId: c.id,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId
      });
    });

    const nextAccounts: CoaAccount[] = coaAccountsRaw
      .map((a: any) => {
        if (!a || typeof a !== 'object') return null;
        const tenantId = a.tenantId;
        const companyId = a.companyId;
        if (!tenantId || !companyId) return null;
        const chartId = chartByCompanyKey.get(`${tenantId}:${companyId}`);
        if (!chartId) return null;

        const code = typeof a.code === 'string' ? a.code : '';
        const codeNormalized =
          typeof a.codeNormalized === 'string' && a.codeNormalized ? a.codeNormalized : normalizeCoaCode(code);

        const kind = a.kind;
        const type =
          kind === 'ASSET' ||
          kind === 'LIABILITY' ||
          kind === 'EQUITY' ||
          kind === 'REVENUE' ||
          kind === 'EXPENSE' ||
          kind === 'OFF_BALANCE'
            ? kind
            : 'ASSET';

        return {
          id: typeof a.id === 'string' && a.id ? a.id : createUuid(),
          tenantId,
          companyId,
          chartId,
          parentAccountId: a.parentAccountId != null ? a.parentAccountId : null,
          code,
          codeNormalized,
          name: typeof a.name === 'string' ? a.name : '',
          type,
          isPostable: a.isPosting !== undefined ? !!a.isPosting : true,
          status: a.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          meta: a.meta != null ? a.meta : null,
          createdAt: a.createdAt != null ? a.createdAt : now,
          updatedAt: a.updatedAt != null ? a.updatedAt : now,
          deletedAt: a.deletedAt != null ? a.deletedAt : null,
          createdByUserId: a.createdByUserId != null ? a.createdByUserId : actorUserId,
          updatedByUserId: a.updatedByUserId != null ? a.updatedByUserId : actorUserId
        } as CoaAccount;
      })
      .filter(Boolean) as CoaAccount[];

    coaCharts = nextCharts;
    coaAccounts = nextAccounts;
  } else {
    coaAccounts = coaAccountsRaw as CoaAccount[];
  }

  const normalized: RegistryStore = {
    version: 1,
    ui: {
      currentTenantId: ui && ui.currentTenantId != null ? ui.currentTenantId : null,
      currentCompanyId: ui && ui.currentCompanyId != null ? ui.currentCompanyId : null,
      currentUserId: ui && ui.currentUserId != null ? ui.currentUserId : null
    },
    tenants: Array.isArray(candidate.tenants) ? candidate.tenants : [],
    tenantSettings: Array.isArray(candidate.tenantSettings) ? candidate.tenantSettings : [],
    organizations: Array.isArray(candidate.organizations) ? candidate.organizations : [],
    groups: Array.isArray(candidate.groups) ? candidate.groups : [],
    companies,
    companyGroups,
    users: Array.isArray(candidate.users) ? candidate.users : [],
    roles: Array.isArray(candidate.roles) ? candidate.roles : [],
    permissions: ensurePermissionsCatalog(Array.isArray(candidate.permissions) ? candidate.permissions : []),
    rolePermissions: Array.isArray(candidate.rolePermissions) ? candidate.rolePermissions : [],
    userCompanyMemberships,
    userRoleAssignments,
    jobFunctions: Array.isArray(candidate.jobFunctions) ? (candidate.jobFunctions as JobFunction[]) : [],
    employees: Array.isArray(candidate.employees) ? (candidate.employees as Employee[]) : [],
    customers: Array.isArray(candidate.customers) ? (candidate.customers as Customer[]) : [],
    customerCompanyAccess: Array.isArray(candidate.customerCompanyAccess)
      ? (candidate.customerCompanyAccess as CustomerCompanyAccess[])
      : [],
    suppliers: Array.isArray(candidate.suppliers) ? (candidate.suppliers as Supplier[]) : [],
    supplierCompanyAccess: Array.isArray(candidate.supplierCompanyAccess)
      ? (candidate.supplierCompanyAccess as SupplierCompanyAccess[])
      : [],
    financeTitles: Array.isArray(candidate.financeTitles) ? (candidate.financeTitles as FinanceTitle[]) : [],
    financeSettlements: Array.isArray(candidate.financeSettlements)
      ? (candidate.financeSettlements as FinanceSettlement[])
      : [],
    coaCharts,
    coaAccounts,
    codeTemplates: codeTemplatesRaw as CodeTemplate[],
    codeSequences: codeSequencesRaw as CodeSequence[],
    auditLogs: Array.isArray(candidate.auditLogs) ? candidate.auditLogs : []
  };

  return ensureSystemAdminRoleHasAllPermissions(normalized);
}

function ensureSeed(store: RegistryStore): RegistryStore {
  const now = nowIso();

  const currentUserId = store.ui.currentUserId || createUuid();
  const permissions = ensurePermissionsCatalog(store.permissions || []);
  const nextStore: RegistryStore = { ...store, ui: { ...store.ui, currentUserId }, permissions };

  if (nextStore.tenants.length > 0) return nextStore;

  const tenantId = createUuid();
  const companyId = createUuid();

  const demoTenant: Tenant = {
    id: tenantId,
    name: 'Demo Tenant',
    status: 'ACTIVE',
    primaryDomain: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const demoSettings: TenantSettings = {
    tenantId,
    useOrganizations: false,
    useGroups: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const demoCompany: Company = {
    id: companyId,
    tenantId,
    organizationId: null,
    code: 'MAIN',
    legalName: null,
    tradeName: 'Empresa Principal',
    taxId: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const demoUser: User = {
    id: currentUserId,
    tenantId,
    email: 'admin@demo.local',
    name: 'Admin',
    status: 'ACTIVE',
    passwordHash: null,
    authProvider: 'DEV',
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const roleId = createUuid();
  const demoRole: Role = {
    id: roleId,
    tenantId,
    name: 'Admin',
    scope: 'TENANT',
    isSystem: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const rolePermissions: RolePermission[] = permissions.map(p => ({
    tenantId,
    roleId,
    permissionId: p.id,
    createdAt: now,
    createdByUserId: currentUserId
  }));

  const userCompanyMemberships: UserCompanyMembership[] = [
    {
      tenantId,
      userId: demoUser.id,
      companyId,
      status: 'ACTIVE',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      createdByUserId: currentUserId,
      updatedByUserId: currentUserId
    }
  ];

  const userRoleAssignments: UserRoleAssignment[] = [
    {
      tenantId,
      userId: demoUser.id,
      roleId,
      scopeCompanyId: null,
      scopeOrganizationId: null,
      createdAt: now,
      createdByUserId: currentUserId
    }
  ];

  const demoCustomer: Customer = {
    id: createUuid(),
    tenantId,
    name: 'Cliente Demo',
    documentType: 'OUTRO',
    documentNumber: 'DEMO-CUSTOMER',
    email: null,
    phone: null,
    status: 'ACTIVE',
    isShared: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const demoChartId = createUuid();
  const demoCoaChart: CoaChart = {
    id: demoChartId,
    tenantId,
    name: 'Plano Padrão',
    scope: 'TENANT',
    organizationId: null,
    companyId: null,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: currentUserId,
    updatedByUserId: currentUserId
  };

  const coaAccounts: CoaAccount[] = [
    {
      id: createUuid(),
      tenantId,
      companyId: null,
      chartId: demoChartId,
      parentAccountId: null,
      code: '1',
      codeNormalized: '1',
      name: 'Ativo',
      type: 'ASSET',
      isPostable: false,
      status: 'ACTIVE',
      meta: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdByUserId: currentUserId,
      updatedByUserId: currentUserId
    },
    {
      id: createUuid(),
      tenantId,
      companyId: null,
      chartId: demoChartId,
      parentAccountId: null,
      code: '2',
      codeNormalized: '2',
      name: 'Passivo',
      type: 'LIABILITY',
      isPostable: false,
      status: 'ACTIVE',
      meta: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdByUserId: currentUserId,
      updatedByUserId: currentUserId
    }
  ];

  return {
    ...nextStore,
    ui: { ...nextStore.ui, currentTenantId: tenantId, currentCompanyId: companyId },
    tenants: [demoTenant],
    tenantSettings: [demoSettings],
    organizations: [] as Organization[],
    groups: [] as Group[],
    companies: [demoCompany],
    companyGroups: [] as CompanyGroup[],
    users: [demoUser],
    roles: [demoRole],
    permissions,
    rolePermissions,
    userCompanyMemberships,
    userRoleAssignments,
    jobFunctions: [] as JobFunction[],
    employees: [] as Employee[],
    customers: [demoCustomer],
    customerCompanyAccess: [] as CustomerCompanyAccess[],
    suppliers: [] as Supplier[],
    supplierCompanyAccess: [] as SupplierCompanyAccess[],
    financeTitles: [] as FinanceTitle[],
    financeSettlements: [] as FinanceSettlement[],
    coaCharts: [demoCoaChart],
    coaAccounts,
    codeTemplates: [] as CodeTemplate[],
    codeSequences: [] as CodeSequence[],
    auditLogs: []
  };
}

export function loadRegistryStore(): RegistryStore {
  const raw = readRaw();
  if (!raw) {
    const seeded = ensureSeed(createEmptyStore());
    writeRaw(JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = ensureSeed(normalizeStore(parsed));
    writeRaw(JSON.stringify(normalized));
    return normalized;
  } catch (_err) {
    const seeded = ensureSeed(createEmptyStore());
    writeRaw(JSON.stringify(seeded));
    return seeded;
  }
}

export function saveRegistryStore(store: RegistryStore): void {
  writeRaw(JSON.stringify(store));
}

export function updateRegistryStore(updater: (store: RegistryStore) => RegistryStore): RegistryStore {
  const store = loadRegistryStore();
  const next = updater(store);
  saveRegistryStore(next);
  return next;
}

export function setCurrentTenantId(tenantId: UUID | null): RegistryStore {
  const updated = updateRegistryStore(store => ({
    ...store,
    ui: { ...store.ui, currentTenantId: tenantId, currentCompanyId: null }
  }));
  emitContextUpdated();
  return updated;
}

export function setCurrentCompanyId(companyId: UUID | null): RegistryStore {
  const updated = updateRegistryStore(store => ({ ...store, ui: { ...store.ui, currentCompanyId: companyId } }));
  emitContextUpdated();
  return updated;
}

export function setCurrentUserId(userId: UUID | null): RegistryStore {
  const updated = updateRegistryStore(store => ({ ...store, ui: { ...store.ui, currentUserId: userId } }));
  emitContextUpdated();
  return updated;
}
