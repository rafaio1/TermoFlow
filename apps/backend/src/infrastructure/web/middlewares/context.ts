import type { Request } from 'express';
import { z } from 'zod';

const UuidHeader = z.string().uuid();

export function getTenantId(req: Request): string {
  return UuidHeader.parse(req.get('x-tenant-id'));
}

export function getActorUserId(req: Request): string {
  return UuidHeader.parse(req.get('x-user-id'));
}

export function getOptionalCompanyId(req: Request): string | null {
  const value = req.get('x-company-id');
  if (!value) return null;
  return UuidHeader.parse(value);
}
