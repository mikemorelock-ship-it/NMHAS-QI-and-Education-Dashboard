-- AlterTable: Add metricDefinitionId column to Campaign
ALTER TABLE "Campaign" ADD COLUMN "metricDefinitionId" TEXT REFERENCES "MetricDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Campaign_metricDefinitionId_idx" ON "Campaign"("metricDefinitionId");

-- CreateTable
CREATE TABLE "CampaignDivision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDivision_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDivision_campaignId_divisionId_key" ON "CampaignDivision"("campaignId", "divisionId");

-- CreateIndex
CREATE INDEX "CampaignDivision_campaignId_idx" ON "CampaignDivision"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignDivision_divisionId_idx" ON "CampaignDivision"("divisionId");

-- CreateTable
CREATE TABLE "CampaignRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignRegion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Individual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRegion_campaignId_regionId_key" ON "CampaignRegion"("campaignId", "regionId");

-- CreateIndex
CREATE INDEX "CampaignRegion_campaignId_idx" ON "CampaignRegion"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignRegion_regionId_idx" ON "CampaignRegion"("regionId");
