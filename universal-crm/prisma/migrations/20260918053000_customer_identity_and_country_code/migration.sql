-- Migration: 20260918053000_customer_identity_and_country_code
-- Additive migration for Customer Identity layer and universal defaultCountryCode on Company

-- AlterTable: add universal defaultCountryCode
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "defaultCountryCode" TEXT NOT NULL DEFAULT 'IN';

-- CreateTable: Customer identity
CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "companyName" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Customer phones with normalized identity
CREATE TABLE IF NOT EXISTS "customer_phones" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rawPhone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "countryCode" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MOBILE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Customer emails
CREATE TABLE IF NOT EXISTS "customer_emails" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WORK',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_emails_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Lead.customerId for Customer -> Enquiry link
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_companyId_idx" ON "customers"("companyId");
CREATE INDEX IF NOT EXISTS "customers_companyId_name_idx" ON "customers"("companyId", "name");
CREATE INDEX IF NOT EXISTS "customers_companyId_deletedAt_idx" ON "customers"("companyId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "customer_phones_companyId_normalizedPhone_key" ON "customer_phones"("companyId", "normalizedPhone");
CREATE INDEX IF NOT EXISTS "customer_phones_companyId_customerId_idx" ON "customer_phones"("companyId", "customerId");
CREATE INDEX IF NOT EXISTS "customer_phones_companyId_normalizedPhone_idx" ON "customer_phones"("companyId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "customer_emails_companyId_email_key" ON "customer_emails"("companyId", "email");
CREATE INDEX IF NOT EXISTS "customer_emails_companyId_customerId_idx" ON "customer_emails"("companyId", "customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leads_companyId_customerId_idx" ON "leads"("companyId", "customerId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_companyId_fkey') THEN
        ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_phones_companyId_fkey') THEN
        ALTER TABLE "customer_phones" ADD CONSTRAINT "customer_phones_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_phones_customerId_fkey') THEN
        ALTER TABLE "customer_phones" ADD CONSTRAINT "customer_phones_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_emails_companyId_fkey') THEN
        ALTER TABLE "customer_emails" ADD CONSTRAINT "customer_emails_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_emails_customerId_fkey') THEN
        ALTER TABLE "customer_emails" ADD CONSTRAINT "customer_emails_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_customerId_fkey') THEN
        ALTER TABLE "leads" ADD CONSTRAINT "leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
