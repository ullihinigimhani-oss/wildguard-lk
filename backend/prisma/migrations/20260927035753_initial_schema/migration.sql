-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RANGER', 'PARK_MANAGER', 'COMMUNITY_LIAISON', 'RESEARCHER', 'COMMUNITY_USER');

-- CreateEnum
CREATE TYPE "PatrolStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESPONDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESPONSE_IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Park" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Park_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patrol" (
    "id" TEXT NOT NULL,
    "routeName" TEXT NOT NULL,
    "description" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" "PatrolStatus" NOT NULL DEFAULT 'SCHEDULED',
    "parkId" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patrol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolLocation" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patrolId" TEXT NOT NULL,

    CONSTRAINT "PatrolLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolWaypoint" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patrolId" TEXT NOT NULL,

    CONSTRAINT "PatrolWaypoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "manualLocation" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'PENDING',
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "occurredAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "patrolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEvidence" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "caption" TEXT,
    "incidentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "species" TEXT,
    "description" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "manualLocation" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'PENDING',
    "reporterName" TEXT,
    "reporterPhone" TEXT,
    "reporterId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReportEvidence" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReportEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "animalCode" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "name" TEXT,
    "sex" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingCollar" (
    "id" TEXT NOT NULL,
    "collarCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "animalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingCollar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalLocation" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MOCK_COLLAR',
    "animalId" TEXT NOT NULL,

    CONSTRAINT "AnimalLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" "RiskLevel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "centerLatitude" DOUBLE PRECISION NOT NULL,
    "centerLongitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL,
    "parkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "animalId" TEXT NOT NULL,
    "riskZoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAcknowledgement" (
    "id" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AlertAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraTrap" (
    "id" TEXT NOT NULL,
    "cameraCode" TEXT NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraTrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraTrapImage" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "species" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MOCK_CAMERA_TRAP',
    "cameraTrapId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraTrapImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_parkId_idx" ON "User"("parkId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Patrol_parkId_idx" ON "Patrol"("parkId");

-- CreateIndex
CREATE INDEX "Patrol_rangerId_idx" ON "Patrol"("rangerId");

-- CreateIndex
CREATE INDEX "Patrol_status_idx" ON "Patrol"("status");

-- CreateIndex
CREATE INDEX "PatrolLocation_patrolId_idx" ON "PatrolLocation"("patrolId");

-- CreateIndex
CREATE INDEX "PatrolWaypoint_patrolId_idx" ON "PatrolWaypoint"("patrolId");

-- CreateIndex
CREATE INDEX "Incident_reporterId_idx" ON "Incident"("reporterId");

-- CreateIndex
CREATE INDEX "Incident_parkId_idx" ON "Incident"("parkId");

-- CreateIndex
CREATE INDEX "Incident_patrolId_idx" ON "Incident"("patrolId");

-- CreateIndex
CREATE INDEX "Incident_incidentType_idx" ON "Incident"("incidentType");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "IncidentEvidence_incidentId_idx" ON "IncidentEvidence"("incidentId");

-- CreateIndex
CREATE INDEX "CommunityReport_status_idx" ON "CommunityReport"("status");

-- CreateIndex
CREATE INDEX "CommunityReport_reporterId_idx" ON "CommunityReport"("reporterId");

-- CreateIndex
CREATE INDEX "CommunityReportEvidence_reportId_idx" ON "CommunityReportEvidence"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_animalCode_key" ON "Animal"("animalCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingCollar_collarCode_key" ON "TrackingCollar"("collarCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingCollar_animalId_key" ON "TrackingCollar"("animalId");

-- CreateIndex
CREATE INDEX "AnimalLocation_animalId_idx" ON "AnimalLocation"("animalId");

-- CreateIndex
CREATE INDEX "AnimalLocation_recordedAt_idx" ON "AnimalLocation"("recordedAt");

-- CreateIndex
CREATE INDEX "RiskZone_parkId_idx" ON "RiskZone"("parkId");

-- CreateIndex
CREATE INDEX "RiskZone_riskLevel_idx" ON "RiskZone"("riskLevel");

-- CreateIndex
CREATE INDEX "Alert_animalId_idx" ON "Alert"("animalId");

-- CreateIndex
CREATE INDEX "Alert_riskZoneId_idx" ON "Alert"("riskZoneId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "AlertAcknowledgement_userId_idx" ON "AlertAcknowledgement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertAcknowledgement_alertId_userId_key" ON "AlertAcknowledgement"("alertId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CameraTrap_cameraCode_key" ON "CameraTrap"("cameraCode");

-- CreateIndex
CREATE INDEX "CameraTrap_parkId_idx" ON "CameraTrap"("parkId");

-- CreateIndex
CREATE INDEX "CameraTrapImage_cameraTrapId_idx" ON "CameraTrapImage"("cameraTrapId");

-- CreateIndex
CREATE INDEX "CameraTrapImage_reviewStatus_idx" ON "CameraTrapImage"("reviewStatus");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patrol" ADD CONSTRAINT "Patrol_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patrol" ADD CONSTRAINT "Patrol_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patrol" ADD CONSTRAINT "Patrol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolLocation" ADD CONSTRAINT "PatrolLocation_patrolId_fkey" FOREIGN KEY ("patrolId") REFERENCES "Patrol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolWaypoint" ADD CONSTRAINT "PatrolWaypoint_patrolId_fkey" FOREIGN KEY ("patrolId") REFERENCES "Patrol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_patrolId_fkey" FOREIGN KEY ("patrolId") REFERENCES "Patrol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReportEvidence" ADD CONSTRAINT "CommunityReportEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CommunityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingCollar" ADD CONSTRAINT "TrackingCollar_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalLocation" ADD CONSTRAINT "AnimalLocation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskZone" ADD CONSTRAINT "RiskZone_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_riskZoneId_fkey" FOREIGN KEY ("riskZoneId") REFERENCES "RiskZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAcknowledgement" ADD CONSTRAINT "AlertAcknowledgement_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAcknowledgement" ADD CONSTRAINT "AlertAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraTrap" ADD CONSTRAINT "CameraTrap_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraTrapImage" ADD CONSTRAINT "CameraTrapImage_cameraTrapId_fkey" FOREIGN KEY ("cameraTrapId") REFERENCES "CameraTrap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
