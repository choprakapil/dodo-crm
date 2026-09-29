-- AlterTable
-- Drop default 'USD' constraint from companies.currency to uphold architectural invariant:
-- Zero implicit USD fallback at database layer
ALTER TABLE "companies" ALTER COLUMN "currency" DROP DEFAULT;
