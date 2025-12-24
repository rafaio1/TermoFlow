-- Ensure UUID generator exists (used by gen_random_uuid()).
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

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
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
CREATE TABLE IF NOT EXISTS "groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID,
  "code" VARCHAR(100),
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "groups_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "organizations"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "companies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "organization_id" UUID,
  "code" VARCHAR(100),
  "legal_name" TEXT,
  "trade_name" TEXT NOT NULL,
  "tax_id" TEXT,
  "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "companies_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "organizations"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_groups" (
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "company_groups_pkey" PRIMARY KEY ("company_id","group_id"),
  CONSTRAINT "company_groups_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_groups_group_id_tenant_id_fkey" FOREIGN KEY ("group_id","tenant_id") REFERENCES "groups"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "changes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tenant_id_code_key" ON "organizations"("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_id_tenant_id_key" ON "organizations"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "organizations_tenant_id_idx" ON "organizations"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "groups_tenant_id_code_key" ON "groups"("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "groups_id_tenant_id_key" ON "groups"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "groups_tenant_id_idx" ON "groups"("tenant_id");
CREATE INDEX IF NOT EXISTS "groups_tenant_id_organization_id_idx" ON "groups"("tenant_id","organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenant_id_code_key" ON "companies"("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenant_id_tax_id_key" ON "companies"("tenant_id","tax_id");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_id_tenant_id_key" ON "companies"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "companies_tenant_id_idx" ON "companies"("tenant_id");
CREATE INDEX IF NOT EXISTS "companies_tenant_id_organization_id_idx" ON "companies"("tenant_id","organization_id");

CREATE INDEX IF NOT EXISTS "company_groups_tenant_id_company_id_idx" ON "company_groups"("tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "company_groups_tenant_id_group_id_idx" ON "company_groups"("tenant_id","group_id");

CREATE INDEX IF NOT EXISTS "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_events_tenant_id_entity_type_entity_id_idx" ON "audit_events"("tenant_id","entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "audit_events_tenant_id_actor_user_id_created_at_idx" ON "audit_events"("tenant_id","actor_user_id","created_at" DESC);

-- Rule: if tenant_settings.use_organizations=true then companies/groups must have organization_id.
CREATE OR REPLACE FUNCTION "tf_enforce_organization_required"() RETURNS trigger AS $$
DECLARE
  use_org boolean;
BEGIN
  SELECT "use_organizations" INTO use_org
  FROM "tenant_settings"
  WHERE "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL;

  IF COALESCE(use_org, false) = true AND NEW."organization_id" IS NULL THEN
    RAISE EXCEPTION 'organization_id is required when tenant_settings.use_organizations=true (tenant_id=%).', NEW."tenant_id"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_groups_enforce_org_required" ON "groups";
CREATE TRIGGER "trg_groups_enforce_org_required"
BEFORE INSERT OR UPDATE ON "groups"
FOR EACH ROW
EXECUTE FUNCTION "tf_enforce_organization_required"();

DROP TRIGGER IF EXISTS "trg_companies_enforce_org_required" ON "companies";
CREATE TRIGGER "trg_companies_enforce_org_required"
BEFORE INSERT OR UPDATE ON "companies"
FOR EACH ROW
EXECUTE FUNCTION "tf_enforce_organization_required"();

-- Rule: prevent enabling organizations if there are existing null organization_id rows.
CREATE OR REPLACE FUNCTION "tf_tenant_settings_guard_enable_orgs"() RETURNS trigger AS $$
BEGIN
  IF NEW."use_organizations" = true AND (OLD."use_organizations" IS DISTINCT FROM NEW."use_organizations") THEN
    IF EXISTS (
      SELECT 1 FROM "companies"
      WHERE "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL AND "organization_id" IS NULL
    ) OR EXISTS (
      SELECT 1 FROM "groups"
      WHERE "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL AND "organization_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot enable organizations: existing companies/groups without organization_id (tenant_id=%).', NEW."tenant_id"
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_tenant_settings_guard_enable_orgs" ON "tenant_settings";
CREATE TRIGGER "trg_tenant_settings_guard_enable_orgs"
BEFORE UPDATE OF "use_organizations" ON "tenant_settings"
FOR EACH ROW
EXECUTE FUNCTION "tf_tenant_settings_guard_enable_orgs"();
