import { nowIso } from './time';
import { createUuid } from './uuid';
import { loadRegistryStore, updateRegistryStore } from './store';
import { AuditAction, AuditLogEntry, UUID } from './types';

type LogAuditParams = {
  tenantId: UUID;
  companyId?: UUID | null;
  action: AuditAction;
  entityType: string;
  entityId: UUID;
  before?: unknown | null;
  after?: unknown | null;
};

export function logAuditEvent(params: LogAuditParams): AuditLogEntry {
  const store = loadRegistryStore();
  const actorUserId = store.ui.currentUserId || null;

  const entry: AuditLogEntry = {
    id: createUuid(),
    tenantId: params.tenantId,
    companyId: params.companyId !== undefined ? params.companyId : null,
    actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before !== undefined ? params.before : null,
    after: params.after !== undefined ? params.after : null,
    createdAt: nowIso()
  };

  updateRegistryStore(current => ({
    ...current,
    auditLogs: [entry, ...current.auditLogs].slice(0, 1000)
  }));

  return entry;
}

export function listAuditLogs(tenantId: UUID): AuditLogEntry[] {
  const store = loadRegistryStore();
  return store.auditLogs.filter(l => l.tenantId === tenantId);
}
