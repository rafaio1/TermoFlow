-- Extensions
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserCompanyMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Missing composite unique (used by composite FKs)
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_tenant_id_key" ON "users"("id","tenant_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_company_memberships" (
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "status" "UserCompanyMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "user_company_memberships_pkey" PRIMARY KEY ("user_id","company_id"),
  CONSTRAINT "user_company_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_company_memberships_user_id_tenant_id_fkey" FOREIGN KEY ("user_id","tenant_id") REFERENCES "users"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_company_memberships_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One default company per user (soft-delete aware).
CREATE UNIQUE INDEX IF NOT EXISTS "user_company_memberships_default_per_user_key"
ON "user_company_memberships"("tenant_id","user_id")
WHERE "is_default" = true AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "user_company_memberships_tenant_id_user_id_idx" ON "user_company_memberships"("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "user_company_memberships_tenant_id_company_id_idx" ON "user_company_memberships"("tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "user_company_memberships_tenant_id_user_id_is_default_idx" ON "user_company_memberships"("tenant_id","user_id","is_default");

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_role_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "scope_company_id" UUID,
  "scope_organization_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_role_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_role_assignments_user_id_tenant_id_fkey" FOREIGN KEY ("user_id","tenant_id") REFERENCES "users"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_role_assignments_role_id_tenant_id_fkey" FOREIGN KEY ("role_id","tenant_id") REFERENCES "roles"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_role_assignments_scope_company_id_tenant_id_fkey" FOREIGN KEY ("scope_company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "user_role_assignments_scope_organization_id_tenant_id_fkey" FOREIGN KEY ("scope_organization_id","tenant_id") REFERENCES "organizations"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_role_assignments_tenant_id_user_id_idx" ON "user_role_assignments"("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "user_role_assignments_tenant_id_role_id_idx" ON "user_role_assignments"("tenant_id","role_id");
CREATE INDEX IF NOT EXISTS "user_role_assignments_tenant_id_scope_company_id_idx" ON "user_role_assignments"("tenant_id","scope_company_id");
CREATE INDEX IF NOT EXISTS "user_role_assignments_tenant_id_scope_organization_id_idx" ON "user_role_assignments"("tenant_id","scope_organization_id");

-- Prevent duplicates (soft-delete aware).
CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_tenant_scope_unique"
ON "user_role_assignments"("tenant_id","user_id","role_id")
WHERE "scope_company_id" IS NULL AND "scope_organization_id" IS NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_company_scope_unique"
ON "user_role_assignments"("tenant_id","user_id","role_id","scope_company_id")
WHERE "scope_company_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_role_assignments_organization_scope_unique"
ON "user_role_assignments"("tenant_id","user_id","role_id","scope_organization_id")
WHERE "scope_organization_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Rule: enforce role scope requirements.
CREATE OR REPLACE FUNCTION "tf_enforce_user_role_assignment_scope"() RETURNS trigger AS $$
DECLARE
  role_scope "RoleScope";
BEGIN
  SELECT "scope" INTO role_scope
  FROM "roles"
  WHERE "id" = NEW."role_id" AND "tenant_id" = NEW."tenant_id" AND "deleted_at" IS NULL;

  IF role_scope IS NULL THEN
    RAISE EXCEPTION 'Role not found or deleted (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
      USING ERRCODE = '23503';
  END IF;

  IF role_scope = 'COMPANY' THEN
    IF NEW."scope_company_id" IS NULL THEN
      RAISE EXCEPTION 'scope_company_id is required when role.scope=COMPANY (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
        USING ERRCODE = '23514';
    END IF;
    IF NEW."scope_organization_id" IS NOT NULL THEN
      RAISE EXCEPTION 'scope_organization_id must be NULL when role.scope=COMPANY (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
        USING ERRCODE = '23514';
    END IF;
  ELSIF role_scope = 'ORGANIZATION' THEN
    IF NEW."scope_organization_id" IS NULL THEN
      RAISE EXCEPTION 'scope_organization_id is required when role.scope=ORGANIZATION (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
        USING ERRCODE = '23514';
    END IF;
    IF NEW."scope_company_id" IS NOT NULL THEN
      RAISE EXCEPTION 'scope_company_id must be NULL when role.scope=ORGANIZATION (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
        USING ERRCODE = '23514';
    END IF;
  ELSIF role_scope = 'TENANT' THEN
    IF NEW."scope_company_id" IS NOT NULL OR NEW."scope_organization_id" IS NOT NULL THEN
      RAISE EXCEPTION 'scope_company_id and scope_organization_id must be NULL when role.scope=TENANT (tenant_id=%, role_id=%).', NEW."tenant_id", NEW."role_id"
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_user_role_assignments_enforce_scope" ON "user_role_assignments";
CREATE TRIGGER "trg_user_role_assignments_enforce_scope"
BEFORE INSERT OR UPDATE ON "user_role_assignments"
FOR EACH ROW
EXECUTE FUNCTION "tf_enforce_user_role_assignment_scope"();

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_functions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "job_functions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_functions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_functions_tenant_id_name_key" ON "job_functions"("tenant_id","name");
CREATE UNIQUE INDEX IF NOT EXISTS "job_functions_tenant_id_code_key" ON "job_functions"("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "job_functions_id_tenant_id_key" ON "job_functions"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "job_functions_tenant_id_idx" ON "job_functions"("tenant_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "user_id" UUID,
  "job_function_id" UUID,
  "name" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "email" CITEXT,
  "phone" TEXT,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employees_company_id_tenant_id_fkey" FOREIGN KEY ("company_id","tenant_id") REFERENCES "companies"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employees_user_id_tenant_id_fkey" FOREIGN KEY ("user_id","tenant_id") REFERENCES "users"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "employees_job_function_id_tenant_id_fkey" FOREIGN KEY ("job_function_id","tenant_id") REFERENCES "job_functions"("id","tenant_id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_tenant_id_document_key" ON "employees"("tenant_id","document");
CREATE INDEX IF NOT EXISTS "employees_tenant_id_company_id_idx" ON "employees"("tenant_id","company_id");
CREATE INDEX IF NOT EXISTS "employees_tenant_id_user_id_idx" ON "employees"("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "employees_tenant_id_status_idx" ON "employees"("tenant_id","status");

