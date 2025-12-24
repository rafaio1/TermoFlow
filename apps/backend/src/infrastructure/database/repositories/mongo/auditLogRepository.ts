import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../mongo';

export type AuditLog = {
  _id: ObjectId;
  action: string;
  payload: unknown;
  tenantId: string | null;
  actorUserId: string | null;
  createdAt: Date;
};

type CreateAuditLogInput = {
  action: string;
  payload: unknown;
  tenantId?: string | null;
  actorUserId?: string | null;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  const db = getMongoDb();
  const result = await db.collection<Omit<AuditLog, '_id'>>('audit_logs').insertOne({
    action: input.action,
    payload: input.payload,
    tenantId: input.tenantId ?? null,
    actorUserId: input.actorUserId ?? null,
    createdAt: new Date(),
  });

  return { _id: result.insertedId };
}
