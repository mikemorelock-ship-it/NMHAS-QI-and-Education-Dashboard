-- CreateTable
CREATE TABLE "EcosystemMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EcosystemNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "color" TEXT,
    "width" REAL,
    "height" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EcosystemNode_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "EcosystemMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EcosystemEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EcosystemEdge_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "EcosystemMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EcosystemEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "EcosystemNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EcosystemEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "EcosystemNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemMap_slug_key" ON "EcosystemMap"("slug");

-- CreateIndex
CREATE INDEX "EcosystemMap_createdById_idx" ON "EcosystemMap"("createdById");

-- CreateIndex
CREATE INDEX "EcosystemNode_mapId_idx" ON "EcosystemNode"("mapId");

-- CreateIndex
CREATE INDEX "EcosystemNode_linkedEntityType_linkedEntityId_idx" ON "EcosystemNode"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "EcosystemEdge_mapId_idx" ON "EcosystemEdge"("mapId");

-- CreateIndex
CREATE INDEX "EcosystemEdge_sourceNodeId_idx" ON "EcosystemEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "EcosystemEdge_targetNodeId_idx" ON "EcosystemEdge"("targetNodeId");
