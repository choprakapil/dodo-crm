-- AlterTable
-- Drop default 'USD' constraint from offerings.currency to uphold the architectural invariant:
-- Offering currency -> Company currency -> Reject (Zero implicit USD fallback)
ALTER TABLE "offerings" ALTER COLUMN "currency" DROP DEFAULT;
