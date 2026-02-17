-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Division_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Individual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Individual_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "dataDefinition" TEXT,
    "methodology" TEXT,
    "unit" TEXT NOT NULL,
    "format" TEXT,
    "chartType" TEXT NOT NULL DEFAULT 'line',
    "periodType" TEXT NOT NULL DEFAULT 'monthly',
    "category" TEXT,
    "categoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isKpi" BOOLEAN NOT NULL DEFAULT false,
    "target" REAL,
    "aggregationType" TEXT NOT NULL DEFAULT 'average',
    "dataType" TEXT NOT NULL DEFAULT 'continuous',
    "spcSigmaLevel" INTEGER NOT NULL DEFAULT 3,
    "baselineStart" DATETIME,
    "baselineEnd" DATETIME,
    "numeratorLabel" TEXT,
    "denominatorLabel" TEXT,
    "rateMultiplier" INTEGER,
    "rateSuffix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricDefinition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetricDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MetricDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'intervention',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricAnnotation_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'link',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricResource_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricResponsibleParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricResponsibleParty_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "divisionId" TEXT,
    "individualId" TEXT,
    "periodType" TEXT NOT NULL DEFAULT 'monthly',
    "periodStart" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "numerator" REAL,
    "denominator" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricEntry_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScorecardDivision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scorecardId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScorecardDivision_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScorecardDivision_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScorecardRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scorecardId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScorecardRegion_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScorecardRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Individual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScorecardMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scorecardId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScorecardMetric_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScorecardMetric_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetricAssociation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "divisionId" TEXT,
    "regionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricAssociation_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricAssociation_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricAssociation_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Individual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriverDiagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "metricDefinitionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DriverDiagram_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriverNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driverDiagramId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DriverNode_driverDiagramId_fkey" FOREIGN KEY ("driverDiagramId") REFERENCES "DriverDiagram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriverNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DriverNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PdsaCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "outcome" TEXT,
    "driverDiagramId" TEXT,
    "metricDefinitionId" TEXT,
    "changeIdeaNodeId" TEXT,
    "planDescription" TEXT,
    "planPrediction" TEXT,
    "planDataCollection" TEXT,
    "planStartDate" DATETIME,
    "doObservations" TEXT,
    "doStartDate" DATETIME,
    "doEndDate" DATETIME,
    "studyResults" TEXT,
    "studyLearnings" TEXT,
    "studyDate" DATETIME,
    "actDecision" TEXT,
    "actNextSteps" TEXT,
    "actDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PdsaCycle_driverDiagramId_fkey" FOREIGN KEY ("driverDiagramId") REFERENCES "DriverDiagram" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PdsaCycle_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PdsaCycle_changeIdeaNodeId_fkey" FOREIGN KEY ("changeIdeaNodeId") REFERENCES "DriverNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'data_entry',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "employeeId" TEXT,
    "badgeNumber" TEXT,
    "divisionId" TEXT,
    "hireDate" DATETIME,
    "startDate" DATETIME,
    "completionDate" DATETIME,
    "traineeStatus" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "ftoId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingAssignment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingAssignment_ftoId_fkey" FOREIGN KEY ("ftoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TraineePhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "ftoSignoffId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraineePhase_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineePhase_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TrainingPhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineePhase_ftoSignoffId_fkey" FOREIGN KEY ("ftoSignoffId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "ftoId" TEXT NOT NULL,
    "phaseId" TEXT,
    "date" DATETIME NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "narrative" TEXT,
    "mostSatisfactory" TEXT,
    "leastSatisfactory" TEXT,
    "recommendAction" TEXT NOT NULL DEFAULT 'continue',
    "nrtFlag" BOOLEAN NOT NULL DEFAULT false,
    "remFlag" BOOLEAN NOT NULL DEFAULT false,
    "traineeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "supervisorReviewedBy" TEXT,
    "supervisorNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyEvaluation_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_ftoId_fkey" FOREIGN KEY ("ftoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TrainingPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvaluationRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationRating_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "DailyEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvaluationRating_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EvaluationCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Skill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SkillCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillStep_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillSignoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "ftoId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillSignoff_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillSignoff_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillSignoff_ftoId_fkey" FOREIGN KEY ("ftoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "actorId" TEXT,
    "actorType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Division_departmentId_slug_key" ON "Division"("departmentId", "slug");

-- CreateIndex
CREATE INDEX "MetricDefinition_parentId_idx" ON "MetricDefinition"("parentId");

-- CreateIndex
CREATE INDEX "MetricDefinition_categoryId_idx" ON "MetricDefinition"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_departmentId_slug_key" ON "MetricDefinition"("departmentId", "slug");

-- CreateIndex
CREATE INDEX "MetricAnnotation_metricDefinitionId_date_idx" ON "MetricAnnotation"("metricDefinitionId", "date");

-- CreateIndex
CREATE INDEX "MetricResource_metricDefinitionId_idx" ON "MetricResource"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "MetricResponsibleParty_metricDefinitionId_idx" ON "MetricResponsibleParty"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "MetricEntry_departmentId_periodStart_idx" ON "MetricEntry"("departmentId", "periodStart");

-- CreateIndex
CREATE INDEX "MetricEntry_metricDefinitionId_periodStart_idx" ON "MetricEntry"("metricDefinitionId", "periodStart");

-- CreateIndex
CREATE INDEX "MetricEntry_divisionId_periodStart_idx" ON "MetricEntry"("divisionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "MetricEntry_metricDefinitionId_departmentId_divisionId_individualId_periodType_periodStart_key" ON "MetricEntry"("metricDefinitionId", "departmentId", "divisionId", "individualId", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Scorecard_slug_key" ON "Scorecard"("slug");

-- CreateIndex
CREATE INDEX "ScorecardDivision_scorecardId_idx" ON "ScorecardDivision"("scorecardId");

-- CreateIndex
CREATE INDEX "ScorecardDivision_divisionId_idx" ON "ScorecardDivision"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardDivision_scorecardId_divisionId_key" ON "ScorecardDivision"("scorecardId", "divisionId");

-- CreateIndex
CREATE INDEX "ScorecardRegion_scorecardId_idx" ON "ScorecardRegion"("scorecardId");

-- CreateIndex
CREATE INDEX "ScorecardRegion_regionId_idx" ON "ScorecardRegion"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardRegion_scorecardId_regionId_key" ON "ScorecardRegion"("scorecardId", "regionId");

-- CreateIndex
CREATE INDEX "ScorecardMetric_scorecardId_idx" ON "ScorecardMetric"("scorecardId");

-- CreateIndex
CREATE INDEX "ScorecardMetric_metricDefinitionId_idx" ON "ScorecardMetric"("metricDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardMetric_scorecardId_metricDefinitionId_key" ON "ScorecardMetric"("scorecardId", "metricDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "MetricAssociation_metricDefinitionId_idx" ON "MetricAssociation"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "MetricAssociation_divisionId_idx" ON "MetricAssociation"("divisionId");

-- CreateIndex
CREATE INDEX "MetricAssociation_regionId_idx" ON "MetricAssociation"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricAssociation_metricDefinitionId_divisionId_regionId_key" ON "MetricAssociation"("metricDefinitionId", "divisionId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDiagram_slug_key" ON "DriverDiagram"("slug");

-- CreateIndex
CREATE INDEX "DriverDiagram_metricDefinitionId_idx" ON "DriverDiagram"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "DriverNode_driverDiagramId_idx" ON "DriverNode"("driverDiagramId");

-- CreateIndex
CREATE INDEX "DriverNode_parentId_idx" ON "DriverNode"("parentId");

-- CreateIndex
CREATE INDEX "PdsaCycle_driverDiagramId_idx" ON "PdsaCycle"("driverDiagramId");

-- CreateIndex
CREATE INDEX "PdsaCycle_metricDefinitionId_idx" ON "PdsaCycle"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "PdsaCycle_changeIdeaNodeId_idx" ON "PdsaCycle"("changeIdeaNodeId");

-- CreateIndex
CREATE INDEX "PdsaCycle_status_idx" ON "PdsaCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_divisionId_idx" ON "User"("divisionId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "TrainingAssignment_traineeId_idx" ON "TrainingAssignment"("traineeId");

-- CreateIndex
CREATE INDEX "TrainingAssignment_ftoId_idx" ON "TrainingAssignment"("ftoId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_traineeId_ftoId_startDate_key" ON "TrainingAssignment"("traineeId", "ftoId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPhase_slug_key" ON "TrainingPhase"("slug");

-- CreateIndex
CREATE INDEX "TraineePhase_traineeId_idx" ON "TraineePhase"("traineeId");

-- CreateIndex
CREATE INDEX "TraineePhase_phaseId_idx" ON "TraineePhase"("phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineePhase_traineeId_phaseId_key" ON "TraineePhase"("traineeId", "phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCategory_slug_key" ON "EvaluationCategory"("slug");

-- CreateIndex
CREATE INDEX "DailyEvaluation_traineeId_date_idx" ON "DailyEvaluation"("traineeId", "date");

-- CreateIndex
CREATE INDEX "DailyEvaluation_ftoId_idx" ON "DailyEvaluation"("ftoId");

-- CreateIndex
CREATE INDEX "DailyEvaluation_phaseId_idx" ON "DailyEvaluation"("phaseId");

-- CreateIndex
CREATE INDEX "DailyEvaluation_status_idx" ON "DailyEvaluation"("status");

-- CreateIndex
CREATE INDEX "EvaluationRating_evaluationId_idx" ON "EvaluationRating"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationRating_categoryId_idx" ON "EvaluationRating"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationRating_evaluationId_categoryId_key" ON "EvaluationRating"("evaluationId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCategory_slug_key" ON "SkillCategory"("slug");

-- CreateIndex
CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_categoryId_slug_key" ON "Skill"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "SkillStep_skillId_idx" ON "SkillStep"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillStep_skillId_stepNumber_key" ON "SkillStep"("skillId", "stepNumber");

-- CreateIndex
CREATE INDEX "SkillSignoff_traineeId_idx" ON "SkillSignoff"("traineeId");

-- CreateIndex
CREATE INDEX "SkillSignoff_skillId_idx" ON "SkillSignoff"("skillId");

-- CreateIndex
CREATE INDEX "SkillSignoff_ftoId_idx" ON "SkillSignoff"("ftoId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillSignoff_traineeId_skillId_key" ON "SkillSignoff"("traineeId", "skillId");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_success_createdAt_idx" ON "LoginAttempt"("success", "createdAt");
