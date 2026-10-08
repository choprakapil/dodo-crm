-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "allowSalesPriceOverride" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createEnquiryHistoryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customerDirectoryVisibility" TEXT NOT NULL DEFAULT 'DATA_SCOPE',
ADD COLUMN     "historyPreviewFields" JSONB;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "defaultPriceAtCreation" DECIMAL(15,2),
ADD COLUMN     "offeringId" TEXT,
ADD COLUMN     "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "priceUpdatedById" TEXT,
ADD COLUMN     "quotedPrice" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OfferingType" NOT NULL DEFAULT 'PRODUCT',
    "code" TEXT,
    "description" TEXT,
    "defaultPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowSalesPriceOverride" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offerings_companyId_idx" ON "offerings"("companyId");

-- CreateIndex
CREATE INDEX "offerings_companyId_isActive_idx" ON "offerings"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "offerings_companyId_type_idx" ON "offerings"("companyId", "type");

-- CreateIndex
CREATE INDEX "leads_companyId_offeringId_idx" ON "leads"("companyId", "offeringId");

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_priceUpdatedById_fkey" FOREIGN KEY ("priceUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- SEED PERMISSIONS FOR OFFERINGS MODULE
-- =============================================================================

-- Admin roles: add offerings.manage
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_ofr_adm_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'offerings',
    'manage',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Admin'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'offerings' 
    AND p."action" = 'manage'
);

-- Manager roles: add offerings.view, offerings.create, offerings.update, offerings.manage
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_ofr_mgr_', act, '_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'offerings',
    act,
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN (VALUES ('view'), ('create'), ('update'), ('manage')) AS actions(act)
WHERE r.name = 'Manager'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'offerings' 
    AND p."action" = act
);

-- Sales Rep roles: add offerings.view
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_ofr_rep_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'offerings',
    'view',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Sales Rep'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'offerings' 
    AND p."action" = 'view'
);

-- Viewer roles: add offerings.view
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_ofr_viw_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'offerings',
    'view',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Viewer'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'offerings' 
    AND p."action" = 'view'
);

-- Support roles: add offerings.view
INSERT INTO "permissions" ("id", "roleId", "module", "action", "dataScope", "createdAt")
SELECT 
    concat('perm_ofr_sup_', md5(random()::text || clock_timestamp()::text)),
    r.id,
    'offerings',
    'view',
    'COMPANY'::"DataScope",
    CURRENT_TIMESTAMP
FROM "roles" r
WHERE r.name = 'Support'
AND NOT EXISTS (
    SELECT 1 FROM "permissions" p 
    WHERE p."roleId" = r.id 
    AND p."module" = 'offerings' 
    AND p."action" = 'view'
);
