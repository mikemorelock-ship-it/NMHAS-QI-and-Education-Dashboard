-- AlterTable
ALTER TABLE "MetricEntry" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "MetricEntry_createdById_idx" ON "MetricEntry"("createdById");
