export type UUID = string;

export type ISODateTime = string;

export type EntityStatus = 'ACTIVE' | 'INACTIVE';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'BLOCKED';

export type RoleScope = 'TENANT' | 'ORGANIZATION' | 'COMPANY';

export type CoaChartScope = 'TENANT' | 'ORGANIZATION' | 'COMPANY';

export type CoaAccountKind =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'OFF_BALANCE';

export type DocumentType = 'CPF' | 'CNPJ' | 'OUTRO';

export type FinanceTitleType = 'PAYABLE' | 'RECEIVABLE';

export type FinanceTitleStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELED'
  | 'OVERDUE';

export type FinanceCreatedFrom = 'MANUAL' | 'IMPORT' | 'CONTRACT' | 'WHATSAPP';

export type FinanceSettlementMethod = 'PIX' | 'BOLETO' | 'TED' | 'CASH' | 'CARD';

export type CodeTemplateTarget =
  | 'ORGANIZATION_CODE'
  | 'COMPANY_CODE'
  | 'COA_ACCOUNT_CODE'
  | 'CUSTOMER_CODE'
  | 'SUPPLIER_CODE';

export interface AuditFields {
  id: UUID;
  tenantId: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
  createdByUserId: UUID | null;
  updatedByUserId: UUID | null;
}

export interface Tenant extends Omit<AuditFields, 'tenantId'> {
  name: string;
  status: TenantStatus;
  primaryDomain: string | null;
}

export interface TenantSettings {
  tenantId: UUID;
  useOrganizations: boolean;
  useGroups: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdByUserId: UUID | null;
  updatedByUserId: UUID | null;
}

export interface Organization extends AuditFields {
  code: string | null;
  name: string;
  status: EntityStatus;
}

export interface Group extends AuditFields {
  organizationId: UUID | null;
  code: string | null;
  name: string;
}

export interface Company extends AuditFields {
  organizationId: UUID | null;
  code: string | null;
  legalName: string | null;
  tradeName: string;
  taxId: string | null;
  status: EntityStatus;
}

export interface CompanyGroup {
  tenantId: UUID;
  companyId: UUID;
  groupId: UUID;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface User extends AuditFields {
  email: string;
  name: string;
  status: UserStatus;
  passwordHash: string | null;
  authProvider: string | null;
  lastLoginAt: ISODateTime | null;
}

export interface Role extends AuditFields {
  name: string;
  scope: RoleScope;
  isSystem: boolean;
}

export interface Permission {
  id: UUID;
  key: string;
  description: string;
}

export interface RolePermission {
  tenantId: UUID;
  roleId: UUID;
  permissionId: UUID;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface UserCompanyMembership {
  tenantId: UUID;
  userId: UUID;
  companyId: UUID;
  status: EntityStatus;
  isDefault: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdByUserId: UUID | null;
  updatedByUserId: UUID | null;
}

export interface UserRoleAssignment {
  tenantId: UUID;
  userId: UUID;
  roleId: UUID;
  scopeCompanyId: UUID | null;
  scopeOrganizationId: UUID | null;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface JobFunction extends AuditFields {
  name: string;
  code: string | null;
}

export interface Employee extends AuditFields {
  companyId: UUID;
  userId: UUID | null;
  jobFunctionId: UUID | null;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  status: EntityStatus;
}

export interface Customer extends AuditFields {
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  status: EntityStatus;
  isShared: boolean;
}

export interface CustomerCompanyAccess {
  tenantId: UUID;
  customerId: UUID;
  companyId: UUID;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface Supplier extends AuditFields {
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  status: EntityStatus;
  isShared: boolean;
}

export interface SupplierCompanyAccess {
  tenantId: UUID;
  supplierId: UUID;
  companyId: UUID;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface FinanceTitle extends AuditFields {
  companyId: UUID;
  type: FinanceTitleType;
  status: FinanceTitleStatus;
  issueDate: ISODateTime | null;
  dueDate: ISODateTime | null;
  competenceDate: ISODateTime | null;
  amountOriginal: number;
  amountOpen: number;
  currency: string;
  description: string | null;
  documentNumber: string | null;
  installmentNumber: string | null;
  categoryCoaAccountId: UUID | null;
  costCenterId: UUID | null;
  createdFrom: FinanceCreatedFrom;
  customerId: UUID | null;
  supplierId: UUID | null;
}

export interface FinanceSettlement {
  id: UUID;
  tenantId: UUID;
  companyId: UUID;
  titleId: UUID;
  paidAt: ISODateTime;
  amount: number;
  method: FinanceSettlementMethod;
  reference: string | null;
  bankAccountId: UUID | null;
  createdAt: ISODateTime;
  createdByUserId: UUID | null;
}

export interface CoaChart extends AuditFields {
  name: string;
  scope: CoaChartScope;
  organizationId: UUID | null;
  companyId: UUID | null;
  isDefault: boolean;
}

export interface CoaAccount extends AuditFields {
  chartId: UUID;
  companyId: UUID | null;
  parentAccountId: UUID | null;
  code: string;
  codeNormalized: string;
  name: string;
  type: CoaAccountKind;
  isPostable: boolean;
  status: EntityStatus;
  meta: Record<string, unknown> | null;
}

export interface CodeTemplate extends AuditFields {
  target: CodeTemplateTarget;
  name: string;
  pattern: string;
  exampleOutput: string | null;
}

export interface CodeSequence {
  id: UUID;
  tenantId: UUID;
  templateId: UUID;
  scopeCompanyId: UUID | null;
  scopeOrganizationId: UUID | null;
  currentValue: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdByUserId: UUID | null;
  updatedByUserId: UUID | null;
}

export interface AuditLogEntry {
  id: UUID;
  tenantId: UUID;
  companyId: UUID | null;
  actorUserId: UUID | null;
  action: AuditAction;
  entityType: string;
  entityId: UUID;
  before: unknown | null;
  after: unknown | null;
  createdAt: ISODateTime;
}

export interface RegistryUIState {
  currentTenantId: UUID | null;
  currentCompanyId: UUID | null;
  currentUserId: UUID | null;
}

export interface RegistryStore {
  version: 1;
  ui: RegistryUIState;
  tenants: Tenant[];
  tenantSettings: TenantSettings[];
  organizations: Organization[];
  groups: Group[];
  companies: Company[];
  companyGroups: CompanyGroup[];
  users: User[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  userCompanyMemberships: UserCompanyMembership[];
  userRoleAssignments: UserRoleAssignment[];
  jobFunctions: JobFunction[];
  employees: Employee[];
  customers: Customer[];
  customerCompanyAccess: CustomerCompanyAccess[];
  suppliers: Supplier[];
  supplierCompanyAccess: SupplierCompanyAccess[];
  financeTitles: FinanceTitle[];
  financeSettlements: FinanceSettlement[];
  coaCharts: CoaChart[];
  coaAccounts: CoaAccount[];
  codeTemplates: CodeTemplate[];
  codeSequences: CodeSequence[];
  auditLogs: AuditLogEntry[];
}
