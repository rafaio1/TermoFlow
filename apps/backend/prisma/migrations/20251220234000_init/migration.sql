-- Ensure the UUID generator is available for automatic keys.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "primary_domain" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_settings" (
  "tenant_id" UUID NOT NULL,
  "use_organizations" BOOLEAN NOT NULL DEFAULT false,
  "use_groups" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(100),
  "name" TEXT NOT NULL,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tenant_id_code_key" ON "organizations"("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_id_tenant_id_key" ON "organizations"("id", "tenant_id");
CREATE INDEX IF NOT EXISTS "organizations_tenant_id_idx" ON "organizations"("tenant_id");

CREATE INDEX IF NOT EXISTS "items_tenant_id_idx" ON "items"("tenant_id");

-- Seed a default tenant + settings so the registry has something to work with.
INSERT INTO "tenants" ("id", "name", "primary_domain", "created_by_user_id", "updated_by_user_id")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Tenant',
  'demo.local',
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222'
)
ON CONFLICT DO NOTHING;

INSERT INTO "tenant_settings" ("tenant_id", "use_organizations", "use_groups")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  false,
  false
)
ON CONFLICT DO NOTHING;

INSERT INTO "items" ("tenant_id", "name", "created_by_user_id", "updated_by_user_id")
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Lista mestre - integração',
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222'
)
ON CONFLICT DO NOTHING;
