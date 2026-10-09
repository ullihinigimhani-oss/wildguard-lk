-- Park Manager community report review workflow uses exactly four statuses:
-- PENDING, UNDER_REVIEW, VERIFIED, REJECTED.
--
-- Postgres cannot drop enum values, so the type is recreated. Existing rows
-- are remapped instead of lost: RESPONSE_IN_PROGRESS -> UNDER_REVIEW,
-- RESOLVED -> VERIFIED.
ALTER TABLE "CommunityReport" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "CommunityReportStatus" RENAME TO "CommunityReportStatus_legacy";

CREATE TYPE "CommunityReportStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

ALTER TABLE "CommunityReport"
  ALTER COLUMN "status" TYPE "CommunityReportStatus"
  USING (
    CASE "status"::text
      WHEN 'RESPONSE_IN_PROGRESS' THEN 'UNDER_REVIEW'
      WHEN 'RESOLVED' THEN 'VERIFIED'
      ELSE "status"::text
    END
  )::"CommunityReportStatus";

ALTER TABLE "CommunityReport" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "CommunityReportStatus_legacy";