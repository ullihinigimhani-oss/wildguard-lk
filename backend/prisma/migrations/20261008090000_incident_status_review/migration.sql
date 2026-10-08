-- Park Manager review workflow uses exactly four incident statuses:
-- PENDING, UNDER_REVIEW, VERIFIED, REJECTED.
--
-- Postgres cannot drop enum values, so the type is recreated. Existing rows are
-- remapped instead of lost: RESPONDING -> UNDER_REVIEW, RESOLVED -> VERIFIED.
ALTER TABLE "Incident" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "IncidentStatus" RENAME TO "IncidentStatus_legacy";

CREATE TYPE "IncidentStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

ALTER TABLE "Incident"
  ALTER COLUMN "status" TYPE "IncidentStatus"
  USING (
    CASE "status"::text
      WHEN 'RESPONDING' THEN 'UNDER_REVIEW'
      WHEN 'RESOLVED' THEN 'VERIFIED'
      ELSE "status"::text
    END
  )::"IncidentStatus";

ALTER TABLE "Incident" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "IncidentStatus_legacy";
