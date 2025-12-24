-- Ensure UUID generator exists (used by gen_random_uuid()).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CoaAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinanceTitleType" AS ENUM ('PAYABLE', 'RECEIVABLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinanceTitleStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELED', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinanceCreatedFrom" AS ENUM ('MANUAL', 'IMPORT', 'CONTRACT', 'WHATSAPP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinanceSettlementMethod" AS ENUM ('PIX', 'BOLETO', 'TED', 'CASH', 'CARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "coa_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "code" VARCHAR(100),
  "name" TEXT NOT NULL,
  "status" "CoaAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "coa_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coa_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coa_accounts_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_tenant_id_company_id_code_key" ON "coa_accounts"("tenant_id","company_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_id_tenant_id_key" ON "coa_accounts"("id","tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_id_tenant_id_company_id_key" ON "coa_accounts"("id","tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "coa_accounts_tenant_id_company_id_idx" ON "coa_accounts"("tenant_id","company_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "finance_titles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "type" "FinanceTitleType" NOT NULL,
  "status" "FinanceTitleStatus" NOT NULL DEFAULT 'DRAFT',
  "issue_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "competence_date" DATE,
  "amount_original" NUMERIC(19,2) NOT NULL,
  "amount_open" NUMERIC(19,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "description" TEXT,
  "document_number" TEXT,
  "installment_number" VARCHAR(20),
  "category_coa_account_id" UUID,
  "cost_center_id" UUID,
  "created_from" "FinanceCreatedFrom" NOT NULL,
  "customer_id" UUID,
  "supplier_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "finance_titles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_titles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_titles_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_titles_category_coa_account_id_tenant_id_company_id_fkey" FOREIGN KEY ("category_coa_account_id","tenant_id","company_id") REFERENCES "coa_accounts"("id","tenant_id","company_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "finance_titles_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id","tenant_id") REFERENCES "customers"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "finance_titles_supplier_id_tenant_id_fkey" FOREIGN KEY ("supplier_id","tenant_id") REFERENCES "suppliers"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "finance_titles_party_type_check" CHECK (
    ("type" = 'PAYABLE' AND "supplier_id" IS NOT NULL AND "customer_id" IS NULL)
    OR
    ("type" = 'RECEIVABLE' AND "customer_id" IS NOT NULL AND "supplier_id" IS NULL)
  )
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "finance_titles_id_tenant_id_key" ON "finance_titles"("id","tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_titles_id_tenant_id_company_id_key" ON "finance_titles"("id","tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "finance_titles_tenant_id_company_id_idx" ON "finance_titles"("tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "finance_titles_tenant_id_company_id_type_status_idx" ON "finance_titles"("tenant_id","company_id","type","status");
CREATE INDEX IF NOT EXISTS "finance_titles_tenant_id_company_id_due_date_idx" ON "finance_titles"("tenant_id","company_id","due_date");

-- Enforce customer/supplier visibility per company when not shared.
CREATE OR REPLACE FUNCTION "tf_enforce_finance_title_party_visibility"() RETURNS trigger AS $$
DECLARE
  is_shared boolean;
BEGIN
  IF NEW."type" = 'PAYABLE' THEN
    SELECT "is_shared" INTO is_shared
    FROM "suppliers"
    WHERE "id" = NEW."supplier_id" AND "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL;

    IF is_shared IS NULL THEN
      RAISE EXCEPTION 'Supplier not found or deleted (tenant_id=%, supplier_id=%).', NEW."tenant_id", NEW."supplier_id"
        USING ERRCODE = '23503';
    END IF;

    IF COALESCE(is_shared, false) = false THEN
      IF NOT EXISTS (
        SELECT 1
        FROM "supplier_company_access"
        WHERE "tenant_id" = NEW."tenant_id"
          AND "supplier_id" = NEW."supplier_id"
          AND "company_id" = NEW."company_id"
          AND "deleted_at" IS NULL
      ) THEN
        RAISE EXCEPTION 'Supplier is not visible to company (tenant_id=%, supplier_id=%, company_id=%).', NEW."tenant_id", NEW."supplier_id", NEW."company_id"
          USING ERRCODE = '23514';
      END IF;
    END IF;

  ELSIF NEW."type" = 'RECEIVABLE' THEN
    SELECT "is_shared" INTO is_shared
    FROM "customers"
    WHERE "id" = NEW."customer_id" AND "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL;

    IF is_shared IS NULL THEN
      RAISE EXCEPTION 'Customer not found or deleted (tenant_id=%, customer_id=%).', NEW."tenant_id", NEW."customer_id"
        USING ERRCODE = '23503';
    END IF;

    IF COALESCE(is_shared, false) = false THEN
      IF NOT EXISTS (
        SELECT 1
        FROM "customer_company_access"
        WHERE "tenant_id" = NEW."tenant_id"
          AND "customer_id" = NEW."customer_id"
          AND "company_id" = NEW."company_id"
          AND "deleted_at" IS NULL
      ) THEN
        RAISE EXCEPTION 'Customer is not visible to company (tenant_id=%, customer_id=%, company_id=%).', NEW."tenant_id", NEW."customer_id", NEW."company_id"
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_finance_titles_enforce_party_visibility" ON "finance_titles";
CREATE TRIGGER "trg_finance_titles_enforce_party_visibility"
BEFORE INSERT OR UPDATE ON "finance_titles"
FOR EACH ROW
EXECUTE FUNCTION "tf_enforce_finance_title_party_visibility"();

-- CreateTable
CREATE TABLE IF NOT EXISTS "finance_settlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "title_id" UUID NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "amount" NUMERIC(19,2) NOT NULL,
  "method" "FinanceSettlementMethod" NOT NULL,
  "reference" TEXT,
  "bank_account_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "finance_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_settlements_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_settlements_title_id_tenant_id_company_id_fkey" FOREIGN KEY ("title_id","tenant_id","company_id") REFERENCES "finance_titles"("id","tenant_id","company_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_settlements_id_tenant_id_key" ON "finance_settlements"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "finance_settlements_tenant_id_company_id_paid_at_idx" ON "finance_settlements"("tenant_id","company_id","paid_at" DESC);
CREATE INDEX IF NOT EXISTS "finance_settlements_tenant_id_title_id_idx" ON "finance_settlements"("tenant_id","title_id");

