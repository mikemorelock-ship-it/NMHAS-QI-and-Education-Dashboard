-- AlterTable: Add division/region scoping to Campaign
ALTER TABLE "Campaign" ADD COLUMN "divisionId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "regionId" TEXT;

-- CreateTable: CampaignShareLink for public sharing
CREATE TABLE "CampaignShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignShareLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignShareLink_token_key" ON "CampaignShareLink"("token");

-- CreateIndex
CREATE INDEX "CampaignShareLink_token_idx" ON "CampaignShareLink"("token");

-- CreateIndex
CREATE INDEX "CampaignShareLink_campaignId_idx" ON "CampaignShareLink"("campaignId");

-- CreateIndex
CREATE INDEX "Campaign_divisionId_idx" ON "Campaign"("divisionId");

-- CreateIndex
CREATE INDEX "Campaign_regionId_idx" ON "Campaign"("regionId");
