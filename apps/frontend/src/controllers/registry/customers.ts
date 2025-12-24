import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { Customer, CustomerCompanyAccess, DocumentType, EntityStatus, UUID } from './types';

type CreateCustomerInput = {
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  status?: EntityStatus;
  isShared?: boolean;
  companyIds?: UUID[];
};

type UpdateCustomerInput = {
  name?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  email?: string | null;
  phone?: string | null;
  status?: EntityStatus;
  isShared?: boolean;
  companyIds?: UUID[];
};

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) throw new Error(`${field} is required`);
}

function normalizeDocumentType(value: string): DocumentType {
  const v = value.trim().toUpperCase();
  if (v === 'CPF' || v === 'CNPJ' || v === 'OUTRO') return v as DocumentType;
  throw new Error('invalid_document_type');
}

function normalizeDocumentNumber(documentType: DocumentType, value: string): string {
  const trimmed = value.trim();
  if (documentType === 'CPF' || documentType === 'CNPJ') return trimmed.replace(/\D+/g, '');
  return trimmed.toLowerCase();
}

function dedupe(values: UUID[]): UUID[] {
  return Array.from(new Set(values));
}

function assertCompanyIdsExist(tenantId: UUID, companyIds: UUID[]): void {
  if (!companyIds.length) return;
  const store = loadRegistryStore();
  const valid = new Set(
    store.companies.filter(c => c.tenantId === tenantId && c.deletedAt === null).map(c => c.id)
  );
  const invalid = companyIds.find(id => !valid.has(id));
  if (invalid) throw new Error('company_not_found');
}

export function listCustomers(tenantId: UUID): Customer[] {
  const store = loadRegistryStore();
  return store.customers.filter(c => c.tenantId === tenantId && c.deletedAt === null);
}

export function listCustomerAccessCompanyIds(tenantId: UUID, customerId: UUID): UUID[] {
  const store = loadRegistryStore();
  return store.customerCompanyAccess
    .filter(a => a.tenantId === tenantId && a.customerId === customerId)
    .map(a => a.companyId);
}

export function listCustomersVisibleToCompany(tenantId: UUID, companyId: UUID): Customer[] {
  const store = loadRegistryStore();
  const accessSet = new Set(
    store.customerCompanyAccess
      .filter(a => a.tenantId === tenantId && a.companyId === companyId)
      .map(a => a.customerId)
  );
  return store.customers.filter(c => {
    if (c.tenantId !== tenantId) return false;
    if (c.deletedAt !== null) return false;
    if (c.isShared) return true;
    return accessSet.has(c.id);
  });
}

export function createCustomer(tenantId: UUID, input: CreateCustomerInput): Customer {
  assertNonEmpty(input.name, 'name');
  assertNonEmpty(input.documentType, 'documentType');
  assertNonEmpty(input.documentNumber, 'documentNumber');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const documentType = normalizeDocumentType(String(input.documentType));
  const documentNumberNormalized = normalizeDocumentNumber(documentType, input.documentNumber);
  if (!documentNumberNormalized) throw new Error('documentNumber is required');

  const exists = store.customers.some(c => {
    if (c.tenantId !== tenantId) return false;
    if (c.deletedAt !== null) return false;
    const dt = normalizeDocumentType(String(c.documentType));
    const dn = normalizeDocumentNumber(dt, c.documentNumber);
    return dt === documentType && dn === documentNumberNormalized;
  });
  if (exists) throw new Error('customer_document_already_exists');

  const isShared = !!input.isShared;
  const companyIds = dedupe(input.companyIds || []);
  if (!isShared) assertCompanyIdsExist(tenantId, companyIds);

  const customer: Customer = {
    id: createUuid(),
    tenantId,
    name: input.name.trim(),
    documentType,
    documentNumber: input.documentNumber.trim(),
    email: input.email !== undefined ? input.email : null,
    phone: input.phone !== undefined ? input.phone : null,
    status: input.status || 'ACTIVE',
    isShared,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId
  };

  const access: CustomerCompanyAccess[] = !isShared
    ? companyIds.map(companyId => ({
        tenantId,
        customerId: customer.id,
        companyId,
        createdAt: now,
        createdByUserId: actorUserId
      }))
    : [];

  updateRegistryStore(current => ({
    ...current,
    customers: [customer, ...current.customers],
    customerCompanyAccess: [...access, ...current.customerCompanyAccess]
  }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'customers',
    entityId: customer.id,
    after: customer
  });

  if (access.length) {
    logAuditEvent({
      tenantId,
      action: 'CREATE',
      entityType: 'customer_company_access',
      entityId: customer.id,
      after: access.map(a => a.companyId).sort()
    });
  }

  return customer;
}

export function updateCustomer(tenantId: UUID, customerId: UUID, patch: UpdateCustomerInput): Customer {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.customers.find(c => c.tenantId === tenantId && c.id === customerId && c.deletedAt === null);
  if (!existing) throw new Error('customer_not_found');

  const now = nowIso();
  const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
  const nextDocumentType = patch.documentType !== undefined ? normalizeDocumentType(String(patch.documentType)) : existing.documentType;
  const nextDocumentNumber = patch.documentNumber !== undefined ? patch.documentNumber.trim() : existing.documentNumber;
  const nextDocumentNormalized = normalizeDocumentNumber(nextDocumentType, nextDocumentNumber);
  if (!nextDocumentNormalized) throw new Error('documentNumber is required');

  const exists = store.customers.some(c => {
    if (c.tenantId !== tenantId) return false;
    if (c.deletedAt !== null) return false;
    if (c.id === customerId) return false;
    const dt = normalizeDocumentType(String(c.documentType));
    const dn = normalizeDocumentNumber(dt, c.documentNumber);
    return dt === nextDocumentType && dn === nextDocumentNormalized;
  });
  if (exists) throw new Error('customer_document_already_exists');

  const nextIsShared = patch.isShared !== undefined ? !!patch.isShared : existing.isShared;
  const nextCompanyIds = patch.companyIds !== undefined ? dedupe(patch.companyIds || []) : [];
  if (!nextIsShared && patch.companyIds !== undefined) assertCompanyIdsExist(tenantId, nextCompanyIds);

  const updated: Customer = {
    ...existing,
    name: nextName,
    documentType: nextDocumentType,
    documentNumber: nextDocumentNumber,
    email: patch.email !== undefined ? patch.email : existing.email,
    phone: patch.phone !== undefined ? patch.phone : existing.phone,
    status: patch.status !== undefined ? patch.status : existing.status,
    isShared: nextIsShared,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  assertNonEmpty(updated.name, 'name');

  const access: CustomerCompanyAccess[] =
    patch.companyIds !== undefined && !nextIsShared
      ? nextCompanyIds.map(companyId => ({
          tenantId,
          customerId,
          companyId,
          createdAt: now,
          createdByUserId: actorUserId
        }))
      : [];

  updateRegistryStore(current => ({
    ...current,
    customers: current.customers.map(c => (c.id === customerId ? updated : c)),
    customerCompanyAccess:
      patch.companyIds !== undefined || patch.isShared !== undefined
        ? [
            ...current.customerCompanyAccess.filter(a => !(a.tenantId === tenantId && a.customerId === customerId)),
            ...(nextIsShared ? [] : access)
          ]
        : current.customerCompanyAccess
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'customers',
    entityId: customerId,
    before: existing,
    after: updated
  });

  if (patch.companyIds !== undefined || patch.isShared !== undefined) {
    const afterCompanyIds = nextIsShared ? [] : listCustomerAccessCompanyIds(tenantId, customerId);
    logAuditEvent({
      tenantId,
      action: 'UPDATE',
      entityType: 'customer_company_access',
      entityId: customerId,
      before: store.customerCompanyAccess
        .filter(a => a.tenantId === tenantId && a.customerId === customerId)
        .map(a => a.companyId)
        .sort(),
      after: afterCompanyIds.slice().sort()
    });
  }

  return updated;
}

export function deleteCustomer(tenantId: UUID, customerId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.customers.find(c => c.tenantId === tenantId && c.id === customerId && c.deletedAt === null);
  if (!existing) throw new Error('customer_not_found');

  const now = nowIso();
  const deleted: Customer = {
    ...existing,
    status: 'INACTIVE',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    customers: current.customers.map(c => (c.id === customerId ? deleted : c)),
    customerCompanyAccess: current.customerCompanyAccess.filter(
      a => !(a.tenantId === tenantId && a.customerId === customerId)
    )
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'customers',
    entityId: customerId,
    before: existing,
    after: deleted
  });
}

