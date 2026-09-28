-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "dispositionId" TEXT,
ADD COLUMN     "dispositionUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "dispositionUpdatedById" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "type" "TaskType" NOT NULL DEFAULT 'FOLLOW_UP';

-- CreateTable
CREATE TABLE "dispositions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "color" TEXT DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpMandatory" BOOLEAN NOT NULL DEFAULT false,
    "allowsClose" BOOLEAN NOT NULL DEFAULT true,
    "allowsConvert" BOOLEAN NOT NULL DEFAULT false,
    "cancelActiveFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_disposition_histories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromDispositionId" TEXT,
    "toDispositionId" TEXT NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "followUpTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_disposition_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reschedule_histories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "leadId" TEXT,
    "eventType" "TaskLifecycleEventType" NOT NULL,
    "previousDueAt" TIMESTAMP(3),
    "newDueAt" TIMESTAMP(3),
    "dispositionId" TEXT,
    "reason" TEXT,
    "outcome" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reschedule_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositions_companyId_idx" ON "dispositions"("companyId");

-- CreateIndex
CREATE INDEX "dispositions_companyId_parentId_idx" ON "dispositions"("companyId", "parentId");

-- CreateIndex
CREATE INDEX "dispositions_companyId_isActive_idx" ON "dispositions"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "dispositions_companyId_deletedAt_idx" ON "dispositions"("companyId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "dispositions_companyId_parentId_name_key" ON "dispositions"("companyId", "parentId", "name");

-- CreateIndex
CREATE INDEX "lead_disposition_histories_companyId_leadId_idx" ON "lead_disposition_histories"("companyId", "leadId");

-- CreateIndex
CREATE INDEX "lead_disposition_histories_leadId_createdAt_idx" ON "lead_disposition_histories"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "task_reschedule_histories_companyId_taskId_idx" ON "task_reschedule_histories"("companyId", "taskId");

-- CreateIndex
CREATE INDEX "task_reschedule_histories_companyId_leadId_idx" ON "task_reschedule_histories"("companyId", "leadId");

-- CreateIndex
CREATE INDEX "leads_companyId_dispositionId_idx" ON "leads"("companyId", "dispositionId");

-- CreateIndex
CREATE INDEX "tasks_companyId_type_status_idx" ON "tasks"("companyId", "type", "status");

-- Scoped PostgreSQL partial unique index: ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK
CREATE UNIQUE INDEX "tasks_single_active_followup_per_lead_idx" 
ON "tasks" ("companyId", "leadId") 
WHERE "leadId" IS NOT NULL 
  AND "type" = 'FOLLOW_UP' 
  AND "status" IN ('PENDING', 'OVERDUE');

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "dispositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dispositionUpdatedById_fkey" FOREIGN KEY ("dispositionUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "dispositions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_fromDispositionId_fkey" FOREIGN KEY ("fromDispositionId") REFERENCES "dispositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_toDispositionId_fkey" FOREIGN KEY ("toDispositionId") REFERENCES "dispositions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_disposition_histories" ADD CONSTRAINT "lead_disposition_histories_followUpTaskId_fkey" FOREIGN KEY ("followUpTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_histories" ADD CONSTRAINT "task_reschedule_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_histories" ADD CONSTRAINT "task_reschedule_histories_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_histories" ADD CONSTRAINT "task_reschedule_histories_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_histories" ADD CONSTRAINT "task_reschedule_histories_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "dispositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_histories" ADD CONSTRAINT "task_reschedule_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
