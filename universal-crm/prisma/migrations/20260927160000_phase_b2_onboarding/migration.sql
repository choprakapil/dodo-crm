-- AlterTable
ALTER TABLE "companies" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onboardingStep" TEXT NOT NULL DEFAULT 'PROFILE',
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
