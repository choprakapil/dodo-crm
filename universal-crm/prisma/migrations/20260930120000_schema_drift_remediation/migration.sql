-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "LeadImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "planId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "completedById" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "teamId" TEXT;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "description" TEXT,
ADD COLUMN "managerId" TEXT;

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'LEAD',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "fieldType" "CustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'LEAD',
    "entityId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_imports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "filename" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" "LeadImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_sessions" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "PlanTier" NOT NULL,
    "description" TEXT,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxLeads" INTEGER NOT NULL DEFAULT 500,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "beforeState" JSONB,
    "afterState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_planId_idx" ON "companies"("planId");

-- CreateIndex
CREATE INDEX "teams_companyId_isActive_idx" ON "teams"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "tasks_companyId_leadId_createdAt_idx" ON "tasks"("companyId", "leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tasks_companyId_assignedUserId_dueAt_idx" ON "tasks"("companyId", "assignedUserId", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_teamId_idx" ON "tasks"("teamId");

-- CreateIndex
CREATE INDEX "custom_fields_companyId_entityType_active_sortOrder_idx" ON "custom_fields"("companyId", "entityType", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "custom_fields_companyId_entityType_key_idx" ON "custom_fields"("companyId", "entityType", "key");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_companyId_entityType_key_key" ON "custom_fields"("companyId", "entityType", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_companyId_entityId_idx" ON "custom_field_values"("companyId", "entityId");

-- CreateIndex
CREATE INDEX "custom_field_values_companyId_customFieldId_entityId_idx" ON "custom_field_values"("companyId", "customFieldId", "entityId");

-- CreateIndex
CREATE INDEX "custom_field_values_companyId_entityType_entityId_idx" ON "custom_field_values"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_companyId_customFieldId_entityId_key" ON "custom_field_values"("companyId", "customFieldId", "entityId");

-- CreateIndex
CREATE INDEX "lead_imports_companyId_createdAt_idx" ON "lead_imports"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_imports_companyId_status_idx" ON "lead_imports"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_sessions_tokenHash_key" ON "super_admin_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "super_admin_sessions_superAdminId_idx" ON "super_admin_sessions"("superAdminId");

-- CreateIndex
CREATE INDEX "super_admin_sessions_expiresAt_idx" ON "super_admin_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "platform_audit_logs_superAdminId_idx" ON "platform_audit_logs"("superAdminId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_idx" ON "platform_audit_logs"("action");

-- CreateIndex
CREATE INDEX "platform_audit_logs_entityType_entityId_idx" ON "platform_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_sessions" ADD CONSTRAINT "super_admin_sessions_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
