-- AlterTable
ALTER TABLE "companies" ADD COLUMN "appliedTemplateKey" TEXT,
ADD COLUMN "appliedTemplateVersion" INTEGER,
ADD COLUMN "appliedTemplateAt" TIMESTAMP(3);
