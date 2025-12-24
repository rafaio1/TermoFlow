import { logAuditEvent } from './audit';
import { loadRegistryStore, updateRegistryStore } from './store';
import { nowIso } from './time';
import { createUuid } from './uuid';
import {
  FinanceCreatedFrom,
  FinanceSettlement,
  FinanceSettlementMethod,
  FinanceTitle,
  FinanceTitleStatus,
  FinanceTitleType,
  UUID
} from './types';

type CreateFinanceTitleInput = {
  companyId: UUID;
  type: FinanceTitleType;
  issueDate?: string | null;
  dueDate?: string | null;
  competenceDate?: string | null;
  amountOriginal: number;
  currency?: string;
  description?: string | null;
  documentNumber?: string | null;
  installmentNumber?: string | null;
  categoryCoaAccountId?: UUID | null;
  costCenterId?: UUID | null;
  createdFrom?: FinanceCreatedFrom;
  customerId?: UUID | null;
  supplierId?: UUID | null;
  status?: FinanceTitleStatus;
};

type UpdateFinanceTitleInput = Partial<Omit<CreateFinanceTitleInput, 'companyId' | 'type'>>;

type CreateFinanceSettlementInput = {
  titleId: UUID;
  paidAt?: string;
  amount: number;
  method: FinanceSettlementMethod;
  reference?: string | null;
  bankAccountId?: UUID | null;
};

function normalizeOptionalString(value: any): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeMoney(value: any, errorCode: string): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num) || num <= 0) throw new Error(errorCode);
  return num;
}

function normalizeFinanceTitleType(value: any): FinanceTitleType {
  if (value === 'PAYABLE' || value === 'RECEIVABLE') return value;
  throw new Error('invalid_finance_title_type');
}

function normalizeFinanceTitleStatus(value: any): FinanceTitleStatus {
  if (
    value === 'DRAFT' ||
    value === 'OPEN' ||
    value === 'PARTIALLY_PAID' ||
    value === 'PAID' ||
    value === 'CANCELED' ||
    value === 'OVERDUE'
  ) {
    return value;
  }
  throw new Error('invalid_finance_title_status');
}

function normalizeCreatedFrom(value: any): FinanceCreatedFrom {
  if (value === 'MANUAL' || value === 'IMPORT' || value === 'CONTRACT' || value === 'WHATSAPP') return value;
  throw new Error('invalid_finance_created_from');
}

function normalizeSettlementMethod(value: any): FinanceSettlementMethod {
  if (value === 'PIX' || value === 'BOLETO' || value === 'TED' || value === 'CASH' || value === 'CARD') return value;
  throw new Error('invalid_finance_settlement_method');
}

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return dueDay < todayDay;
}

function computeStatus(baseStatus: FinanceTitleStatus, amountOriginal: number, amountOpen: number, dueDate: string | null): FinanceTitleStatus {
  if (baseStatus === 'DRAFT') return 'DRAFT';
  if (baseStatus === 'CANCELED') return 'CANCELED';
  if (amountOpen <= 0) return 'PAID';
  if (amountOpen < amountOriginal) return 'PARTIALLY_PAID';
  if (isPastDue(dueDate)) return 'OVERDUE';
  return 'OPEN';
}

function sumSettlements(store: ReturnType<typeof loadRegistryStore>, tenantId: UUID, titleId: UUID): number {
  return store.financeSettlements
    .filter(s => s.tenantId === tenantId && s.titleId === titleId)
    .reduce((total, s) => total + (typeof s.amount === 'number' ? s.amount : Number(s.amount) || 0), 0);
}

function hydrateTitle(store: ReturnType<typeof loadRegistryStore>, title: FinanceTitle): FinanceTitle {
  const amountOriginal =
    typeof title.amountOriginal === 'number' ? title.amountOriginal : Number(title.amountOriginal) || 0;
  const paid = sumSettlements(store, title.tenantId, title.id);
  const amountOpenRaw =
    typeof title.amountOpen === 'number' ? title.amountOpen : Number(title.amountOpen) || 0;
  const amountOpenComputed = Math.max(amountOriginal - paid, 0);
  const amountOpen = Number.isFinite(amountOpenComputed) ? amountOpenComputed : amountOpenRaw;

  const dueDate = title.dueDate != null ? title.dueDate : null;
  const nextStatus = computeStatus(title.status, amountOriginal, amountOpen, dueDate);

  return {
    ...title,
    amountOriginal,
    amountOpen,
    status: nextStatus,
    currency: title.currency ? title.currency : 'BRL'
  };
}

function assertCompanyExists(store: ReturnType<typeof loadRegistryStore>, tenantId: UUID, companyId: UUID): void {
  const exists = store.companies.some(c => c.tenantId === tenantId && c.id === companyId && c.deletedAt === null);
  if (!exists) throw new Error('company_not_found');
}

function assertCustomerVisible(store: ReturnType<typeof loadRegistryStore>, tenantId: UUID, companyId: UUID, customerId: UUID): void {
  const customer = store.customers.find(c => c.tenantId === tenantId && c.id === customerId && c.deletedAt === null);
  if (!customer) throw new Error('customer_not_found');
  if (customer.isShared) return;
  const allowed = store.customerCompanyAccess.some(
    a => a.tenantId === tenantId && a.companyId === companyId && a.customerId === customerId
  );
  if (!allowed) throw new Error('customer_not_visible_to_company');
}

function assertSupplierVisible(store: ReturnType<typeof loadRegistryStore>, tenantId: UUID, companyId: UUID, supplierId: UUID): void {
  const supplier = store.suppliers.find(s => s.tenantId === tenantId && s.id === supplierId && s.deletedAt === null);
  if (!supplier) throw new Error('supplier_not_found');
  if (supplier.isShared) return;
  const allowed = store.supplierCompanyAccess.some(
    a => a.tenantId === tenantId && a.companyId === companyId && a.supplierId === supplierId
  );
  if (!allowed) throw new Error('supplier_not_visible_to_company');
}

function assertCoaAccountValid(store: ReturnType<typeof loadRegistryStore>, tenantId: UUID, companyId: UUID, accountId: UUID): void {
  const account = store.coaAccounts.find(
    a => a.tenantId === tenantId && a.companyId === companyId && a.id === accountId && a.deletedAt === null
  );
  if (!account) throw new Error('coa_account_not_found');
  if (!account.isPostable) throw new Error('coa_account_not_posting');
  if (account.status !== 'ACTIVE') throw new Error('coa_account_inactive');
}

export function listFinanceTitles(tenantId: UUID, companyId: UUID, type?: FinanceTitleType): FinanceTitle[] {
  const store = loadRegistryStore();
  return store.financeTitles
    .filter(t => {
      if (t.tenantId !== tenantId) return false;
      if (t.companyId !== companyId) return false;
      if (t.deletedAt !== null) return false;
      if (type && t.type !== type) return false;
      return true;
    })
    .map(t => hydrateTitle(store, t));
}

export function getFinanceTitle(tenantId: UUID, titleId: UUID): FinanceTitle {
  const store = loadRegistryStore();
  const title = store.financeTitles.find(t => t.tenantId === tenantId && t.id === titleId && t.deletedAt === null);
  if (!title) throw new Error('finance_title_not_found');
  return hydrateTitle(store, title);
}

export function listFinanceSettlementsForTitle(tenantId: UUID, titleId: UUID): FinanceSettlement[] {
  const store = loadRegistryStore();
  return store.financeSettlements
    .filter(s => s.tenantId === tenantId && s.titleId === titleId)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.paidAt).getTime();
      const bTime = new Date(b.paidAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
}

export function createFinanceTitle(tenantId: UUID, input: CreateFinanceTitleInput): FinanceTitle {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const companyId = input.companyId;
  if (!companyId) throw new Error('company_id_required');
  assertCompanyExists(store, tenantId, companyId);

  const type = normalizeFinanceTitleType(input.type);
  const baseStatus = input.status ? normalizeFinanceTitleStatus(input.status) : 'OPEN';

  const customerId = input.customerId !== undefined ? input.customerId : null;
  const supplierId = input.supplierId !== undefined ? input.supplierId : null;

  if (type === 'PAYABLE') {
    if (!supplierId) throw new Error('supplier_id_required');
    if (customerId) throw new Error('invalid_counterparty');
    assertSupplierVisible(store, tenantId, companyId, supplierId);
  } else {
    if (!customerId) throw new Error('customer_id_required');
    if (supplierId) throw new Error('invalid_counterparty');
    assertCustomerVisible(store, tenantId, companyId, customerId);
  }

  const categoryCoaAccountId = input.categoryCoaAccountId !== undefined ? input.categoryCoaAccountId : null;
  if (categoryCoaAccountId) assertCoaAccountValid(store, tenantId, companyId, categoryCoaAccountId);

  const amountOriginal = normalizeMoney(input.amountOriginal, 'amount_original_invalid');
  const amountOpen = amountOriginal;

  const issueDate = normalizeOptionalString(input.issueDate);
  const dueDate = normalizeOptionalString(input.dueDate);
  const competenceDate = normalizeOptionalString(input.competenceDate);

  const currency = input.currency ? String(input.currency).trim() : 'BRL';
  if (!currency) throw new Error('currency_invalid');

  const title: FinanceTitle = {
    id: createUuid(),
    tenantId,
    companyId,
    type,
    status: computeStatus(baseStatus, amountOriginal, amountOpen, dueDate),
    issueDate,
    dueDate,
    competenceDate,
    amountOriginal,
    amountOpen,
    currency,
    description: input.description !== undefined ? input.description : null,
    documentNumber: input.documentNumber !== undefined ? input.documentNumber : null,
    installmentNumber: input.installmentNumber !== undefined ? input.installmentNumber : null,
    categoryCoaAccountId,
    costCenterId: input.costCenterId !== undefined ? input.costCenterId : null,
    createdFrom: input.createdFrom ? normalizeCreatedFrom(input.createdFrom) : 'MANUAL',
    customerId: type === 'RECEIVABLE' ? customerId : null,
    supplierId: type === 'PAYABLE' ? supplierId : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    financeTitles: [title, ...current.financeTitles]
  }));

  logAuditEvent({
    tenantId,
    companyId,
    action: 'CREATE',
    entityType: 'finance_titles',
    entityId: title.id,
    after: title
  });

  return title;
}

export function updateFinanceTitle(tenantId: UUID, titleId: UUID, patch: UpdateFinanceTitleInput): FinanceTitle {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.financeTitles.find(t => t.tenantId === tenantId && t.id === titleId && t.deletedAt === null);
  if (!existing) throw new Error('finance_title_not_found');

  const companyId = existing.companyId;
  const now = nowIso();

  const paid = sumSettlements(store, tenantId, titleId);

  const nextAmountOriginal =
    patch.amountOriginal !== undefined ? normalizeMoney(patch.amountOriginal, 'amount_original_invalid') : existing.amountOriginal;

  const nextAmountOpen = Math.max(nextAmountOriginal - paid, 0);

  const nextIssueDate = patch.issueDate !== undefined ? normalizeOptionalString(patch.issueDate) : existing.issueDate;
  const nextDueDate = patch.dueDate !== undefined ? normalizeOptionalString(patch.dueDate) : existing.dueDate;
  const nextCompetenceDate =
    patch.competenceDate !== undefined ? normalizeOptionalString(patch.competenceDate) : existing.competenceDate;

  const nextCurrency = patch.currency !== undefined ? String(patch.currency).trim() : existing.currency;
  if (!nextCurrency) throw new Error('currency_invalid');

  const nextCategoryCoaAccountId =
    patch.categoryCoaAccountId !== undefined ? patch.categoryCoaAccountId : existing.categoryCoaAccountId;
  if (nextCategoryCoaAccountId) assertCoaAccountValid(store, tenantId, companyId, nextCategoryCoaAccountId);

  const nextCustomerId = patch.customerId !== undefined ? patch.customerId : existing.customerId;
  const nextSupplierId = patch.supplierId !== undefined ? patch.supplierId : existing.supplierId;

  if (existing.type === 'PAYABLE') {
    if (nextCustomerId) throw new Error('invalid_counterparty');
    if (!nextSupplierId) throw new Error('supplier_id_required');
    assertSupplierVisible(store, tenantId, companyId, nextSupplierId);
  } else {
    if (nextSupplierId) throw new Error('invalid_counterparty');
    if (!nextCustomerId) throw new Error('customer_id_required');
    assertCustomerVisible(store, tenantId, companyId, nextCustomerId);
  }

  const updated: FinanceTitle = {
    ...existing,
    issueDate: nextIssueDate,
    dueDate: nextDueDate,
    competenceDate: nextCompetenceDate,
    amountOriginal: nextAmountOriginal,
    amountOpen: nextAmountOpen,
    currency: nextCurrency,
    description: patch.description !== undefined ? patch.description : existing.description,
    documentNumber: patch.documentNumber !== undefined ? patch.documentNumber : existing.documentNumber,
    installmentNumber: patch.installmentNumber !== undefined ? patch.installmentNumber : existing.installmentNumber,
    categoryCoaAccountId: nextCategoryCoaAccountId ? nextCategoryCoaAccountId : null,
    costCenterId: patch.costCenterId !== undefined ? patch.costCenterId : existing.costCenterId,
    createdFrom: patch.createdFrom !== undefined ? normalizeCreatedFrom(patch.createdFrom) : existing.createdFrom,
    customerId: existing.type === 'RECEIVABLE' ? (nextCustomerId ? nextCustomerId : null) : null,
    supplierId: existing.type === 'PAYABLE' ? (nextSupplierId ? nextSupplierId : null) : null,
    status: computeStatus(existing.status, nextAmountOriginal, nextAmountOpen, nextDueDate),
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    financeTitles: current.financeTitles.map(t => (t.id === titleId ? updated : t))
  }));

  logAuditEvent({
    tenantId,
    companyId,
    action: 'UPDATE',
    entityType: 'finance_titles',
    entityId: titleId,
    before: existing,
    after: updated
  });

  return updated;
}

export function cancelFinanceTitle(tenantId: UUID, titleId: UUID): FinanceTitle {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.financeTitles.find(t => t.tenantId === tenantId && t.id === titleId && t.deletedAt === null);
  if (!existing) throw new Error('finance_title_not_found');

  const settlements = store.financeSettlements.filter(s => s.tenantId === tenantId && s.titleId === titleId);
  if (settlements.length) throw new Error('finance_title_has_settlements');

  const now = nowIso();
  const updated: FinanceTitle = {
    ...existing,
    status: 'CANCELED',
    amountOpen: existing.amountOriginal,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    financeTitles: current.financeTitles.map(t => (t.id === titleId ? updated : t))
  }));

  logAuditEvent({
    tenantId,
    companyId: existing.companyId,
    action: 'UPDATE',
    entityType: 'finance_titles',
    entityId: titleId,
    before: existing,
    after: updated
  });

  return updated;
}

export function deleteFinanceTitle(tenantId: UUID, titleId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.financeTitles.find(t => t.tenantId === tenantId && t.id === titleId && t.deletedAt === null);
  if (!existing) throw new Error('finance_title_not_found');

  const now = nowIso();
  const deleted: FinanceTitle = {
    ...existing,
    status: 'CANCELED',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  const removedSettlements = store.financeSettlements.filter(s => s.tenantId === tenantId && s.titleId === titleId);

  updateRegistryStore(current => ({
    ...current,
    financeTitles: current.financeTitles.map(t => (t.id === titleId ? deleted : t)),
    financeSettlements: current.financeSettlements.filter(s => !(s.tenantId === tenantId && s.titleId === titleId))
  }));

  logAuditEvent({
    tenantId,
    companyId: existing.companyId,
    action: 'DELETE',
    entityType: 'finance_titles',
    entityId: titleId,
    before: existing,
    after: deleted
  });

  if (removedSettlements.length) {
    logAuditEvent({
      tenantId,
      companyId: existing.companyId,
      action: 'DELETE',
      entityType: 'finance_settlements',
      entityId: titleId,
      before: removedSettlements.map(s => s.id).sort(),
      after: []
    });
  }
}

export function createFinanceSettlement(tenantId: UUID, input: CreateFinanceSettlementInput): FinanceSettlement {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const title = store.financeTitles.find(t => t.tenantId === tenantId && t.id === input.titleId && t.deletedAt === null);
  if (!title) throw new Error('finance_title_not_found');

  const hydrated = hydrateTitle(store, title);
  if (hydrated.status === 'DRAFT' || hydrated.status === 'CANCELED') throw new Error('finance_title_not_settleable');
  if (hydrated.amountOpen <= 0) throw new Error('finance_title_not_settleable');

  const amount = normalizeMoney(input.amount, 'settlement_amount_invalid');
  if (amount > hydrated.amountOpen) throw new Error('settlement_exceeds_open_amount');

  const settlement: FinanceSettlement = {
    id: createUuid(),
    tenantId,
    companyId: title.companyId,
    titleId: title.id,
    paidAt: input.paidAt ? String(input.paidAt) : now,
    amount,
    method: normalizeSettlementMethod(input.method),
    reference: input.reference !== undefined ? input.reference : null,
    bankAccountId: input.bankAccountId !== undefined ? input.bankAccountId : null,
    createdAt: now,
    createdByUserId: actorUserId
  };

  const nextPaid = sumSettlements(store, tenantId, title.id) + amount;
  const nextAmountOpen = Math.max(hydrated.amountOriginal - nextPaid, 0);
  const nextStatus = computeStatus(title.status, hydrated.amountOriginal, nextAmountOpen, hydrated.dueDate);

  const updatedTitle: FinanceTitle = {
    ...title,
    amountOriginal: hydrated.amountOriginal,
    amountOpen: nextAmountOpen,
    status: nextStatus,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    financeSettlements: [settlement, ...current.financeSettlements],
    financeTitles: current.financeTitles.map(t => (t.id === title.id ? updatedTitle : t))
  }));

  logAuditEvent({
    tenantId,
    companyId: title.companyId,
    action: 'CREATE',
    entityType: 'finance_settlements',
    entityId: settlement.id,
    after: settlement
  });

  logAuditEvent({
    tenantId,
    companyId: title.companyId,
    action: 'UPDATE',
    entityType: 'finance_titles',
    entityId: title.id,
    before: title,
    after: updatedTitle
  });

  return settlement;
}

export function deleteFinanceSettlement(tenantId: UUID, settlementId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const settlement = store.financeSettlements.find(s => s.tenantId === tenantId && s.id === settlementId);
  if (!settlement) throw new Error('finance_settlement_not_found');

  const title = store.financeTitles.find(t => t.tenantId === tenantId && t.id === settlement.titleId && t.deletedAt === null);
  if (!title) throw new Error('finance_title_not_found');

  const now = nowIso();

  const nextSettlements = store.financeSettlements.filter(s => !(s.tenantId === tenantId && s.id === settlementId));
  const nextPaid = nextSettlements
    .filter(s => s.tenantId === tenantId && s.titleId === title.id)
    .reduce((total, s) => total + (typeof s.amount === 'number' ? s.amount : Number(s.amount) || 0), 0);

  const amountOriginal =
    typeof title.amountOriginal === 'number' ? title.amountOriginal : Number(title.amountOriginal) || 0;
  const nextAmountOpen = Math.max(amountOriginal - nextPaid, 0);
  const nextStatus = computeStatus(title.status, amountOriginal, nextAmountOpen, title.dueDate);

  const updatedTitle: FinanceTitle = {
    ...title,
    amountOriginal,
    amountOpen: nextAmountOpen,
    status: nextStatus,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    financeSettlements: current.financeSettlements.filter(s => !(s.tenantId === tenantId && s.id === settlementId)),
    financeTitles: current.financeTitles.map(t => (t.id === title.id ? updatedTitle : t))
  }));

  logAuditEvent({
    tenantId,
    companyId: title.companyId,
    action: 'DELETE',
    entityType: 'finance_settlements',
    entityId: settlementId,
    before: settlement,
    after: null
  });

  logAuditEvent({
    tenantId,
    companyId: title.companyId,
    action: 'UPDATE',
    entityType: 'finance_titles',
    entityId: title.id,
    before: title,
    after: updatedTitle
  });
}
