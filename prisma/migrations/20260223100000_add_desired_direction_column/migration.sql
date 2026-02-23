-- AlterTable: Add missing desiredDirection column to MetricDefinition
ALTER TABLE "MetricDefinition" ADD COLUMN "desiredDirection" TEXT NOT NULL DEFAULT 'up';
