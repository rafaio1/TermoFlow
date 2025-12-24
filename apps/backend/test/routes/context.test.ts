import { ZodError } from 'zod';

import { getActorUserId, getOptionalCompanyId, getTenantId } from '../../src/infrastructure/web/middlewares/context';

type HeaderValue = string | undefined;

function makeReq(headers: Record<string, HeaderValue>) {
  const normalized = new Map<string, HeaderValue>(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    get: (name: string) => normalized.get(name.toLowerCase()),
  } as any;
}

describe('request context headers', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const companyId = '33333333-3333-3333-3333-333333333333';

  it('parses required headers', () => {
    const req = makeReq({ 'x-tenant-id': tenantId, 'x-user-id': userId });
    expect(getTenantId(req)).toBe(tenantId);
    expect(getActorUserId(req)).toBe(userId);
  });

  it('throws when missing required headers', () => {
    expect(() => getTenantId(makeReq({}))).toThrow(ZodError);
    expect(() => getActorUserId(makeReq({}))).toThrow(ZodError);
  });

  it('throws when required headers are invalid uuids', () => {
    expect(() => getTenantId(makeReq({ 'x-tenant-id': 'not-uuid' }))).toThrow(ZodError);
    expect(() => getActorUserId(makeReq({ 'x-user-id': 'not-uuid' }))).toThrow(ZodError);
  });

  it('returns null when x-company-id is missing', () => {
    expect(getOptionalCompanyId(makeReq({}))).toBeNull();
  });

  it('parses x-company-id when present', () => {
    expect(getOptionalCompanyId(makeReq({ 'x-company-id': companyId }))).toBe(companyId);
  });

  it('throws when x-company-id is invalid', () => {
    expect(() => getOptionalCompanyId(makeReq({ 'x-company-id': 'nope' }))).toThrow(ZodError);
  });
});

