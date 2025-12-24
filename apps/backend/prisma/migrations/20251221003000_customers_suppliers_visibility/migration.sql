-- Extensions
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('CPF', 'CNPJ', 'OUTRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ExternalPartyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "customers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "document_type" "DocumentType" NOT NULL,
  "document_number" TEXT NOT NULL,
  "email" CITEXT,
  "phone" TEXT,
  "status" "ExternalPartyStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_shared" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "document_type" "DocumentType" NOT NULL,
  "document_number" TEXT NOT NULL,
  "email" CITEXT,
  "phone" TEXT,
  "status" "ExternalPartyStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_shared" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable (visibility links)
CREATE TABLE IF NOT EXISTS "customer_company_access" (
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "customer_company_access_pkey" PRIMARY KEY ("customer_id","company_id"),
  CONSTRAINT "customer_company_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_company_access_customer_id_tenant_id_fkey" FOREIGN KEY ("customer_id","tenant_id") REFERENCES "customers"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_company_access_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "supplier_company_access" (
  "tenant_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "supplier_company_access_pkey" PRIMARY KEY ("supplier_id","company_id"),
  CONSTRAINT "supplier_company_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_company_access_supplier_id_tenant_id_fkey" FOREIGN KEY ("supplier_id","tenant_id") REFERENCES "suppliers"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_company_access_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_id_document_type_document_number_key"
ON "customers"("tenant_id","document_type","document_number");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_id_tenant_id_key" ON "customers"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_is_shared_idx" ON "customers"("tenant_id","is_shared");

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenant_id_document_type_document_number_key"
ON "suppliers"("tenant_id","document_type","document_number");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_id_tenant_id_key" ON "suppliers"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_is_shared_idx" ON "suppliers"("tenant_id","is_shared");

CREATE INDEX IF NOT EXISTS "customer_company_access_tenant_id_customer_id_idx" ON "customer_company_access"("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "customer_company_access_tenant_id_company_id_idx" ON "customer_company_access"("tenant_id","company_id");

CREATE INDEX IF NOT EXISTS "supplier_company_access_tenant_id_supplier_id_idx" ON "supplier_company_access"("tenant_id","supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_company_access_tenant_id_company_id_idx" ON "supplier_company_access"("tenant_id","company_id");

