-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "title" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IncidentEvidence" ADD COLUMN     "metadata" JSONB;
