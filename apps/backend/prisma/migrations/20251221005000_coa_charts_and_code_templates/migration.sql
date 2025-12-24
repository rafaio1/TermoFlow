-- Ensure UUID generator exists (used by gen_random_uuid()).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CoaChartScope" AS ENUM ('TENANT', 'ORGANIZATION', 'COMPANY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CoaAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CodeTemplateTarget" AS ENUM ('ORGANIZATION_CODE', 'COMPANY_CODE', 'COA_ACCOUNT_CODE', 'CUSTOMER_CODE', 'SUPPLIER_CODE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "coa_charts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "CoaChartScope" NOT NULL,
  "organization_id" UUID,
  "company_id" UUID,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "coa_charts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coa_charts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coa_charts_organization_id_tenant_id_fkey" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "organizations"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "coa_charts_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "coa_charts_scope_check" CHECK (
    ("scope" = 'TENANT' AND "organization_id" IS NULL AND "company_id" IS NULL)
    OR
    ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL AND "company_id" IS NULL)
    OR
    ("scope" = 'COMPANY' AND "company_id" IS NOT NULL)
  )
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "coa_charts_id_tenant_id_key" ON "coa_charts"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "coa_charts_tenant_id_idx" ON "coa_charts"("tenant_id");
CREATE INDEX IF NOT EXISTS "coa_charts_tenant_id_scope_idx" ON "coa_charts"("tenant_id","scope");
CREATE INDEX IF NOT EXISTS "coa_charts_tenant_id_organization_id_idx" ON "coa_charts"("tenant_id","organization_id");
CREATE INDEX IF NOT EXISTS "coa_charts_tenant_id_company_id_idx" ON "coa_charts"("tenant_id","company_id");

-- Default chart uniqueness per scope instance (soft-delete aware).
CREATE UNIQUE INDEX IF NOT EXISTS "coa_charts_default_tenant_key"
ON "coa_charts"("tenant_id")
WHERE "scope" = 'TENANT' AND "is_default" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "coa_charts_default_organization_key"
ON "coa_charts"("tenant_id","organization_id")
WHERE "scope" = 'ORGANIZATION' AND "is_default" = true AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "coa_charts_default_company_key"
ON "coa_charts"("tenant_id","company_id")
WHERE "scope" = 'COMPANY' AND "is_default" = true AND "deleted_at" IS NULL;

-- Refactor existing coa_accounts (previously company-scoped) to chart-scoped.
ALTER TABLE "coa_accounts" ADD COLUMN IF NOT EXISTS "chart_id" UUID;
ALTER TABLE "coa_accounts" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "coa_accounts" ADD COLUMN IF NOT EXISTS "type" "CoaAccountType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "coa_accounts" ADD COLUMN IF NOT EXISTS "is_postable" BOOLEAN NOT NULL DEFAULT true;

-- Ensure code is always present (stable + audit-friendly).
UPDATE "coa_accounts"
SET "code" = ('AUTO-' || "id"::text)
WHERE "code" IS NULL;

ALTER TABLE "coa_accounts" ALTER COLUMN "code" SET NOT NULL;

-- Backfill charts and link existing accounts (only if coa_accounts still has company_id).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coa_accounts'
      AND column_name = 'company_id'
  ) THEN
    INSERT INTO "coa_charts" (
      "id",
      "tenant_id",
      "name",
      "scope",
      "organization_id",
      "company_id",
      "is_default",
      "created_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      x."tenant_id",
      'Default',
      'COMPANY',
      c."organization_id",
      x."company_id",
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM (
      SELECT DISTINCT "tenant_id", "company_id"
      FROM "coa_accounts"
    ) x
    LEFT JOIN "companies" c
      ON c."id" = x."company_id" AND c."tenant_id" = x."tenant_id"
    WHERE NOT EXISTS (
      SELECT 1
      FROM "coa_charts" cc
      WHERE cc."tenant_id" = x."tenant_id"
        AND cc."company_id" = x."company_id"
        AND cc."scope" = 'COMPANY'
        AND cc."is_default" = true
        AND cc."deleted_at" IS NULL
    );

    UPDATE "coa_accounts" ca
    SET "chart_id" = cc."id"
    FROM "coa_charts" cc
    WHERE ca."chart_id" IS NULL
      AND cc."tenant_id" = ca."tenant_id"
      AND cc."company_id" = ca."company_id"
      AND cc."scope" = 'COMPANY'
      AND cc."is_default" = true
      AND cc."deleted_at" IS NULL;
  END IF;
END $$;

ALTER TABLE "coa_accounts" ALTER COLUMN "chart_id" SET NOT NULL;

-- Drop old company-scoped indexes and FK.
ALTER TABLE "coa_accounts" DROP CONSTRAINT IF EXISTS "coa_accounts_company_id_tenant_id_fkey";
DROP INDEX IF EXISTS "coa_accounts_tenant_id_company_id_code_key";
DROP INDEX IF EXISTS "coa_accounts_id_tenant_id_company_id_key";
DROP INDEX IF EXISTS "coa_accounts_tenant_id_company_id_idx";

-- New constraints / indexes.
DO $$ BEGIN
  ALTER TABLE "coa_accounts"
    ADD CONSTRAINT "coa_accounts_chart_id_tenant_id_fkey"
    FOREIGN KEY ("chart_id","tenant_id") REFERENCES "coa_charts"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "coa_accounts"
    ADD CONSTRAINT "coa_accounts_parent_id_tenant_id_chart_id_fkey"
    FOREIGN KEY ("parent_id","tenant_id","chart_id") REFERENCES "coa_accounts"("id","tenant_id","chart_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_tenant_id_chart_id_code_key" ON "coa_accounts"("tenant_id","chart_id","code");
CREATE INDEX IF NOT EXISTS "coa_accounts_tenant_id_chart_id_idx" ON "coa_accounts"("tenant_id","chart_id");
CREATE INDEX IF NOT EXISTS "coa_accounts_tenant_id_chart_id_parent_id_idx" ON "coa_accounts"("tenant_id","chart_id","parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_id_tenant_id_key" ON "coa_accounts"("id","tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_id_tenant_id_chart_id_key" ON "coa_accounts"("id","tenant_id","chart_id");

-- Remove legacy company_id column (chart now defines scope).
ALTER TABLE "coa_accounts" DROP COLUMN IF EXISTS "company_id";

-- Update finance_titles FK to COA account (now uses (id, tenant_id)).
ALTER TABLE "finance_titles" DROP CONSTRAINT IF EXISTS "finance_titles_category_coa_account_id_tenant_id_company_id_fkey";
DO $$ BEGIN
  ALTER TABLE "finance_titles"
    ADD CONSTRAINT "finance_titles_category_coa_account_id_tenant_id_fkey"
    FOREIGN KEY ("category_coa_account_id","tenant_id") REFERENCES "coa_accounts"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "finance_titles_tenant_id_category_coa_account_id_idx" ON "finance_titles"("tenant_id","category_coa_account_id");

-- Code templates (optional mechanism for generating stable codes).
CREATE TABLE IF NOT EXISTS "code_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "target" "CodeTemplateTarget" NOT NULL,
  "name" TEXT NOT NULL,
  "pattern" TEXT,
  "segments" JSONB,
  "example_output" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "code_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_templates_pattern_or_segments_check" CHECK ("pattern" IS NOT NULL OR "segments" IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS "code_templates_tenant_id_target_name_key" ON "code_templates"("tenant_id","target","name");
CREATE UNIQUE INDEX IF NOT EXISTS "code_templates_id_tenant_id_key" ON "code_templates"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "code_templates_tenant_id_target_idx" ON "code_templates"("tenant_id","target");

-- Code sequences (per-tenant/org/company).
CREATE TABLE IF NOT EXISTS "code_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "scope_company_id" UUID,
  "scope_org_id" UUID,
  "current_value" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_sequences_template_id_tenant_id_fkey" FOREIGN KEY ("template_id","tenant_id") REFERENCES "code_templates"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_sequences_scope_company_id_tenant_id_fkey" FOREIGN KEY ("scope_company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "code_sequences_scope_org_id_tenant_id_fkey" FOREIGN KEY ("scope_org_id","tenant_id") REFERENCES "organizations"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "code_sequences_scope_check" CHECK (
    ("scope_company_id" IS NULL AND "scope_org_id" IS NULL)
    OR
    ("scope_company_id" IS NOT NULL AND "scope_org_id" IS NULL)
    OR
    ("scope_company_id" IS NULL AND "scope_org_id" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "code_sequences_tenant_id_template_id_idx" ON "code_sequences"("tenant_id","template_id");
CREATE INDEX IF NOT EXISTS "code_sequences_tenant_id_scope_company_id_idx" ON "code_sequences"("tenant_id","scope_company_id");
CREATE INDEX IF NOT EXISTS "code_sequences_tenant_id_scope_org_id_idx" ON "code_sequences"("tenant_id","scope_org_id");

-- Uniqueness per scope (soft-delete aware).
CREATE UNIQUE INDEX IF NOT EXISTS "code_sequences_tenant_scope_unique"
ON "code_sequences"("tenant_id","template_id")
WHERE "scope_company_id" IS NULL AND "scope_org_id" IS NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "code_sequences_company_scope_unique"
ON "code_sequences"("tenant_id","template_id","scope_company_id")
WHERE "scope_company_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "code_sequences_org_scope_unique"
ON "code_sequences"("tenant_id","template_id","scope_org_id")
WHERE "scope_org_id" IS NOT NULL AND "deleted_at" IS NULL;

