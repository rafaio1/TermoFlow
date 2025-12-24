-- Case-insensitive email support (users.email uses CITEXT).
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RoleScope" AS ENUM ('TENANT', 'ORGANIZATION', 'COMPANY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "password_hash" TEXT,
  "auth_provider" TEXT,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "RoleScope" NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "tenant_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,

  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id"),
  CONSTRAINT "role_permissions_role_id_tenant_id_fkey" FOREIGN KEY ("role_id","tenant_id") REFERENCES "roles"("id","tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- Indexes / Uniques
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_email_key" ON "users"("tenant_id","email");
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_id_status_idx" ON "users"("tenant_id","status");

CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_id_name_key" ON "roles"("tenant_id","name");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_id_tenant_id_key" ON "roles"("id","tenant_id");
CREATE INDEX IF NOT EXISTS "roles_tenant_id_idx" ON "roles"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");

CREATE INDEX IF NOT EXISTS "role_permissions_tenant_id_role_id_idx" ON "role_permissions"("tenant_id","role_id");
CREATE INDEX IF NOT EXISTS "role_permissions_tenant_id_permission_id_idx" ON "role_permissions"("tenant_id","permission_id");

