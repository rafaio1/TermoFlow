import { logAuditEvent } from './audit';
import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { DocumentType, EntityStatus, Supplier, SupplierCompanyAccess, UUID } from './types';

type CreateSupplierInput = {
  name: string;
  documentType: DocumentType;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  status?: EntityStatus;
  isShared?: boolean;
  companyIds?: UUID[];
};

type UpdateSupplierInput = {
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

export function listSuppliers(tenantId: UUID): Supplier[] {
  const store = loadRegistryStore();
  return store.suppliers.filter(s => s.tenantId === tenantId && s.deletedAt === null);
}

export function listSupplierAccessCompanyIds(tenantId: UUID, supplierId: UUID): UUID[] {
  const store = loadRegistryStore();
  return store.supplierCompanyAccess
    .filter(a => a.tenantId === tenantId && a.supplierId === supplierId)
    .map(a => a.companyId);
}

export function listSuppliersVisibleToCompany(tenantId: UUID, companyId: UUID): Supplier[] {
  const store = loadRegistryStore();
  const accessSet = new Set(
    store.supplierCompanyAccess
      .filter(a => a.tenantId === tenantId && a.companyId === companyId)
      .map(a => a.supplierId)
  );
  return store.suppliers.filter(s => {
    if (s.tenantId !== tenantId) return false;
    if (s.deletedAt !== null) return false;
    if (s.isShared) return true;
    return accessSet.has(s.id);
  });
}

export function createSupplier(tenantId: UUID, input: CreateSupplierInput): Supplier {
  assertNonEmpty(input.name, 'name');
  assertNonEmpty(input.documentType, 'documentType');
  assertNonEmpty(input.documentNumber, 'documentNumber');

  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;
  const now = nowIso();

  const documentType = normalizeDocumentType(String(input.documentType));
  const documentNumberNormalized = normalizeDocumentNumber(documentType, input.documentNumber);
  if (!documentNumberNormalized) throw new Error('documentNumber is required');

  const exists = store.suppliers.some(s => {
    if (s.tenantId !== tenantId) return false;
    if (s.deletedAt !== null) return false;
    const dt = normalizeDocumentType(String(s.documentType));
    const dn = normalizeDocumentNumber(dt, s.documentNumber);
    return dt === documentType && dn === documentNumberNormalized;
  });
  if (exists) throw new Error('supplier_document_already_exists');

  const isShared = !!input.isShared;
  const companyIds = dedupe(input.companyIds || []);
  if (!isShared) assertCompanyIdsExist(tenantId, companyIds);

  const supplier: Supplier = {
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

  const access: SupplierCompanyAccess[] = !isShared
    ? companyIds.map(companyId => ({
        tenantId,
        supplierId: supplier.id,
        companyId,
        createdAt: now,
        createdByUserId: actorUserId
      }))
    : [];

  updateRegistryStore(current => ({
    ...current,
    suppliers: [supplier, ...current.suppliers],
    supplierCompanyAccess: [...access, ...current.supplierCompanyAccess]
  }));

  logAuditEvent({
    tenantId,
    action: 'CREATE',
    entityType: 'suppliers',
    entityId: supplier.id,
    after: supplier
  });

  if (access.length) {
    logAuditEvent({
      tenantId,
      action: 'CREATE',
      entityType: 'supplier_company_access',
      entityId: supplier.id,
      after: access.map(a => a.companyId).sort()
    });
  }

  return supplier;
}

export function updateSupplier(tenantId: UUID, supplierId: UUID, patch: UpdateSupplierInput): Supplier {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.suppliers.find(s => s.tenantId === tenantId && s.id === supplierId && s.deletedAt === null);
  if (!existing) throw new Error('supplier_not_found');

  const now = nowIso();
  const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
  const nextDocumentType = patch.documentType !== undefined ? normalizeDocumentType(String(patch.documentType)) : existing.documentType;
  const nextDocumentNumber = patch.documentNumber !== undefined ? patch.documentNumber.trim() : existing.documentNumber;
  const nextDocumentNormalized = normalizeDocumentNumber(nextDocumentType, nextDocumentNumber);
  if (!nextDocumentNormalized) throw new Error('documentNumber is required');

  const exists = store.suppliers.some(s => {
    if (s.tenantId !== tenantId) return false;
    if (s.deletedAt !== null) return false;
    if (s.id === supplierId) return false;
    const dt = normalizeDocumentType(String(s.documentType));
    const dn = normalizeDocumentNumber(dt, s.documentNumber);
    return dt === nextDocumentType && dn === nextDocumentNormalized;
  });
  if (exists) throw new Error('supplier_document_already_exists');

  const nextIsShared = patch.isShared !== undefined ? !!patch.isShared : existing.isShared;
  const nextCompanyIds = patch.companyIds !== undefined ? dedupe(patch.companyIds || []) : [];
  if (!nextIsShared && patch.companyIds !== undefined) assertCompanyIdsExist(tenantId, nextCompanyIds);

  const updated: Supplier = {
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

  const access: SupplierCompanyAccess[] =
    patch.companyIds !== undefined && !nextIsShared
      ? nextCompanyIds.map(companyId => ({
          tenantId,
          supplierId,
          companyId,
          createdAt: now,
          createdByUserId: actorUserId
        }))
      : [];

  updateRegistryStore(current => ({
    ...current,
    suppliers: current.suppliers.map(s => (s.id === supplierId ? updated : s)),
    supplierCompanyAccess:
      patch.companyIds !== undefined || patch.isShared !== undefined
        ? [
            ...current.supplierCompanyAccess.filter(a => !(a.tenantId === tenantId && a.supplierId === supplierId)),
            ...(nextIsShared ? [] : access)
          ]
        : current.supplierCompanyAccess
  }));

  logAuditEvent({
    tenantId,
    action: 'UPDATE',
    entityType: 'suppliers',
    entityId: supplierId,
    before: existing,
    after: updated
  });

  if (patch.companyIds !== undefined || patch.isShared !== undefined) {
    const afterCompanyIds = nextIsShared ? [] : listSupplierAccessCompanyIds(tenantId, supplierId);
    logAuditEvent({
      tenantId,
      action: 'UPDATE',
      entityType: 'supplier_company_access',
      entityId: supplierId,
      before: store.supplierCompanyAccess
        .filter(a => a.tenantId === tenantId && a.supplierId === supplierId)
        .map(a => a.companyId)
        .sort(),
      after: afterCompanyIds.slice().sort()
    });
  }

  return updated;
}

export function deleteSupplier(tenantId: UUID, supplierId: UUID): void {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId;

  const existing = store.suppliers.find(s => s.tenantId === tenantId && s.id === supplierId && s.deletedAt === null);
  if (!existing) throw new Error('supplier_not_found');

  const now = nowIso();
  const deleted: Supplier = {
    ...existing,
    status: 'INACTIVE',
    deletedAt: now,
    updatedAt: now,
    updatedByUserId: actorUserId
  };

  updateRegistryStore(current => ({
    ...current,
    suppliers: current.suppliers.map(s => (s.id === supplierId ? deleted : s)),
    supplierCompanyAccess: current.supplierCompanyAccess.filter(
      a => !(a.tenantId === tenantId && a.supplierId === supplierId)
    )
  }));

  logAuditEvent({
    tenantId,
    action: 'DELETE',
    entityType: 'suppliers',
    entityId: supplierId,
    before: existing,
    after: deleted
  });
}

